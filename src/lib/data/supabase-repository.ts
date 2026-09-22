import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Account,
  AccountFilter,
  AccountWithStats,
  ActivityLog,
  Alert,
  Conversation,
  DashboardSummary,
  Listing,
  Message,
  PendingApproval,
  Product,
  ProductImage,
  Sale,
  UserId,
} from '@/types/domain';
import type { NewListing, NewProduct, NewSale, Repository } from './repository';

/* eslint-disable @typescript-eslint/no-explicit-any -- las filas de Supabase
   llegan sin tipar; se convierten a tipos de dominio en los mapeadores de abajo. */

// ── Mapeadores fila → dominio ────────────────────────────────────────────────

function toAccount(row: any): Account {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    isDemo: row.is_demo,
    lastSyncedAt: row.last_synced_at,
    attentionReason: row.attention_reason,
    createdAt: row.created_at,
  };
}

function toProductImage(row: any): ProductImage {
  return {
    id: row.id,
    productId: row.product_id,
    url: row.url,
    kind: row.kind,
    alt: row.alt,
    transformation: row.transformation,
    position: row.position,
    createdAt: row.created_at,
  };
}

function toProduct(row: any): Product {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    brand: row.brand,
    model: row.model,
    category: row.category,
    subcategory: row.subcategory,
    condition: row.condition,
    purchasePriceCents: row.purchase_price_cents,
    targetPriceCents: row.target_price_cents,
    minPriceCents: row.min_price_cents,
    salePriceCents: row.sale_price_cents,
    internalDescription: row.internal_description,
    publicDescription: row.public_description,
    features: row.features ?? {},
    sku: row.sku,
    stock: row.stock,
    internalNotes: row.internal_notes,
    images: (row.product_images ?? [])
      .map(toProductImage)
      .sort((a: ProductImage, b: ProductImage) => a.position - b.position),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toListing(row: any): Listing {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    productId: row.product_id,
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    status: row.status,
    categoryLeafId: row.category_leaf_id,
    externalItemId: row.external_item_id,
    hashtags: row.hashtags ?? [],
    attentionReason: row.attention_reason,
    lastOptimizedAt: row.last_optimized_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessage(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    body: row.body,
    used: row.used,
    createdAt: row.created_at,
  };
}

function toConversation(row: any): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    listingId: row.listing_id,
    buyerAlias: row.buyer_alias,
    status: row.status,
    priority: row.priority,
    lastOfferCents: row.last_offer_cents,
    messages: (row.messages ?? [])
      .map(toMessage)
      .sort((a: Message, b: Message) => a.createdAt.localeCompare(b.createdAt)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSale(row: any): Sale {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    productId: row.product_id,
    listingId: row.listing_id,
    buyerAlias: row.buyer_alias,
    priceCents: row.price_cents,
    status: row.status,
    method: row.method,
    notes: row.notes,
    soldAt: row.sold_at,
    createdAt: row.created_at,
  };
}

function toActivity(row: any): ActivityLog {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    kind: row.kind,
    message: row.message,
    createdAt: row.created_at,
  };
}

/** Lanza con contexto legible si Supabase devuelve error. */
function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`Error al leer ${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`Sin datos al leer ${what}`);
  return result.data;
}

/**
 * Implementación sobre Supabase/PostgreSQL.
 *
 * Todas las consultas filtran por `user_id` **además** de confiar en RLS.
 * Es redundante a propósito: si una política se rompe, el filtro sigue ahí.
 */
export class SupabaseRepository implements Repository {
  constructor(private readonly db: SupabaseClient) {}

  /** Aplica el filtro de cuenta a una consulta. */
  private scoped(query: any, filter: AccountFilter) {
    return filter === 'all' ? query : query.eq('account_id', filter);
  }

  // ── Cuentas ───────────────────────────────────────────────────────────────

  async listAccounts(userId: UserId): Promise<AccountWithStats[]> {
    const rows = unwrap(
      await this.db.from('accounts').select('*').eq('user_id', userId).order('created_at'),
      'cuentas',
    ) as any[];

    const accounts = rows.map(toAccount);

    // Contadores en paralelo; con pocas cuentas por usuario es más simple y
    // rápido que una vista materializada.
    const stats = await Promise.all(
      accounts.map(async (account) => {
        const [listings, active, pending, sales] = await Promise.all([
          this.count('listings', userId, account.id),
          this.count('listings', userId, account.id, (q) => q.eq('status', 'active')),
          this.count('conversations', userId, account.id, (q) => q.eq('status', 'pending')),
          this.db
            .from('sales')
            .select('price_cents')
            .eq('user_id', userId)
            .eq('account_id', account.id)
            .eq('status', 'completed'),
        ]);

        const saleRows = (sales.data ?? []) as { price_cents: number }[];
        return {
          accountId: account.id,
          listings,
          activeListings: active,
          pendingMessages: pending,
          sales: saleRows.length,
          revenueCents: saleRows.reduce((sum, r) => sum + r.price_cents, 0),
        };
      }),
    );

    return accounts.map((account, i) => ({ ...account, stats: stats[i]! }));
  }

  private async count(
    table: string,
    userId: UserId,
    accountId: string,
    refine?: (q: any) => any,
  ): Promise<number> {
    let query = this.db
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('account_id', accountId);
    if (refine) query = refine(query);
    const { count } = await query;
    return count ?? 0;
  }

  async getAccount(userId: UserId, accountId: string): Promise<Account | null> {
    const { data } = await this.db
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('id', accountId)
      .maybeSingle();
    return data ? toAccount(data) : null;
  }

  async createAccount(userId: UserId, input: { name: string; isDemo: boolean }): Promise<Account> {
    const { count } = await this.db
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const slug = `cuenta-${String((count ?? 0) + 1).padStart(2, '0')}`;
    const row = unwrap(
      await this.db
        .from('accounts')
        .insert({
          user_id: userId,
          name: input.name,
          slug,
          status: input.isDemo ? 'demo' : 'disconnected',
          is_demo: input.isDemo,
          attention_reason: input.isDemo ? null : 'Pendiente de autorizar con Wallapop',
        })
        .select()
        .single(),
      'la cuenta creada',
    );
    return toAccount(row);
  }

  // ── Productos ─────────────────────────────────────────────────────────────

  async listProducts(userId: UserId): Promise<Product[]> {
    const rows = unwrap(
      await this.db
        .from('products')
        .select('*, product_images(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      'productos',
    ) as any[];
    return rows.map(toProduct);
  }

  async getProduct(userId: UserId, productId: string): Promise<Product | null> {
    const { data } = await this.db
      .from('products')
      .select('*, product_images(*)')
      .eq('user_id', userId)
      .eq('id', productId)
      .maybeSingle();
    return data ? toProduct(data) : null;
  }

  async createProduct(userId: UserId, input: NewProduct): Promise<Product> {
    const row = unwrap(
      await this.db
        .from('products')
        .insert({
          user_id: userId,
          name: input.name,
          brand: input.brand,
          model: input.model,
          category: input.category,
          subcategory: input.subcategory,
          condition: input.condition,
          purchase_price_cents: input.purchasePriceCents,
          target_price_cents: input.targetPriceCents,
          min_price_cents: input.minPriceCents,
          internal_description: input.internalDescription,
          public_description: input.publicDescription,
          features: input.features,
          sku: input.sku,
          stock: input.stock,
          internal_notes: input.internalNotes,
        })
        .select('*, product_images(*)')
        .single(),
      'el producto creado',
    );
    return toProduct(row);
  }

  async updateProduct(
    userId: UserId,
    productId: string,
    patch: Partial<NewProduct>,
  ): Promise<Product> {
    const payload: Record<string, unknown> = {};
    const map: Record<keyof NewProduct, string> = {
      name: 'name',
      brand: 'brand',
      model: 'model',
      category: 'category',
      subcategory: 'subcategory',
      condition: 'condition',
      purchasePriceCents: 'purchase_price_cents',
      targetPriceCents: 'target_price_cents',
      minPriceCents: 'min_price_cents',
      internalDescription: 'internal_description',
      publicDescription: 'public_description',
      features: 'features',
      sku: 'sku',
      stock: 'stock',
      internalNotes: 'internal_notes',
    };
    for (const [key, column] of Object.entries(map)) {
      const value = patch[key as keyof NewProduct];
      if (value !== undefined) payload[column] = value;
    }

    const row = unwrap(
      await this.db
        .from('products')
        .update(payload)
        .eq('user_id', userId)
        .eq('id', productId)
        .select('*, product_images(*)')
        .single(),
      'el producto actualizado',
    );
    return toProduct(row);
  }

  // ── Anuncios ──────────────────────────────────────────────────────────────

  async listListings(userId: UserId, filter: AccountFilter): Promise<Listing[]> {
    const rows = unwrap(
      await this.scoped(
        this.db
          .from('listings')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false }),
        filter,
      ),
      'anuncios',
    ) as any[];
    return rows.map(toListing);
  }

  async getListing(userId: UserId, listingId: string): Promise<Listing | null> {
    const { data } = await this.db
      .from('listings')
      .select('*')
      .eq('user_id', userId)
      .eq('id', listingId)
      .maybeSingle();
    return data ? toListing(data) : null;
  }

  async createListing(userId: UserId, input: NewListing): Promise<Listing> {
    const row = unwrap(
      await this.db
        .from('listings')
        .insert({
          user_id: userId,
          account_id: input.accountId,
          product_id: input.productId,
          title: input.title,
          description: input.description,
          price_cents: input.priceCents,
          status: input.status,
          category_leaf_id: input.categoryLeafId,
          hashtags: input.hashtags,
        })
        .select()
        .single(),
      'el anuncio creado',
    );
    return toListing(row);
  }

  async updateListing(
    userId: UserId,
    listingId: string,
    patch: Partial<NewListing>,
  ): Promise<Listing> {
    const payload: Record<string, unknown> = {};
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.priceCents !== undefined) payload.price_cents = patch.priceCents;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.categoryLeafId !== undefined) payload.category_leaf_id = patch.categoryLeafId;
    if (patch.hashtags !== undefined) payload.hashtags = patch.hashtags;
    if (patch.accountId !== undefined) payload.account_id = patch.accountId;

    const row = unwrap(
      await this.db
        .from('listings')
        .update(payload)
        .eq('user_id', userId)
        .eq('id', listingId)
        .select()
        .single(),
      'el anuncio actualizado',
    );
    return toListing(row);
  }

  // ── Conversaciones ────────────────────────────────────────────────────────

  async listConversations(userId: UserId, filter: AccountFilter): Promise<Conversation[]> {
    const rows = unwrap(
      await this.scoped(
        this.db
          .from('conversations')
          .select('*, messages(*)')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false }),
        filter,
      ),
      'conversaciones',
    ) as any[];
    return rows.map(toConversation);
  }

  async getConversation(userId: UserId, conversationId: string): Promise<Conversation | null> {
    const { data } = await this.db
      .from('conversations')
      .select('*, messages(*)')
      .eq('user_id', userId)
      .eq('id', conversationId)
      .maybeSingle();
    return data ? toConversation(data) : null;
  }

  async appendMessage(
    userId: UserId,
    conversationId: string,
    input: { role: Message['role']; body: string },
  ): Promise<Message> {
    // Comprobación explícita de pertenencia antes de escribir.
    const conversation = await this.getConversation(userId, conversationId);
    if (!conversation) throw new Error('Conversación no encontrada');

    const row = unwrap(
      await this.db
        .from('messages')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          role: input.role,
          body: input.body,
        })
        .select()
        .single(),
      'el mensaje creado',
    );
    return toMessage(row);
  }

  // ── Ventas ────────────────────────────────────────────────────────────────

  async listSales(userId: UserId, filter: AccountFilter): Promise<Sale[]> {
    const rows = unwrap(
      await this.scoped(
        this.db
          .from('sales')
          .select('*')
          .eq('user_id', userId)
          .order('sold_at', { ascending: false }),
        filter,
      ),
      'ventas',
    ) as any[];
    return rows.map(toSale);
  }

  async createSale(userId: UserId, input: NewSale): Promise<Sale> {
    const row = unwrap(
      await this.db
        .from('sales')
        .insert({
          user_id: userId,
          account_id: input.accountId,
          product_id: input.productId,
          listing_id: input.listingId,
          buyer_alias: input.buyerAlias,
          price_cents: input.priceCents,
          status: input.status,
          method: input.method,
          notes: input.notes,
        })
        .select()
        .single(),
      'la venta creada',
    );
    return toSale(row);
  }

  // ── Panel ─────────────────────────────────────────────────────────────────

  async getDashboardSummary(userId: UserId, filter: AccountFilter): Promise<DashboardSummary> {
    const [accounts, listings, conversations, sales, recentActivity, pendingApprovals, products] =
      await Promise.all([
        this.listAccounts(userId),
        this.listListings(userId, filter),
        this.listConversations(userId, filter),
        this.listSales(userId, filter),
        this.listActivity(userId, filter, 6),
        this.listPendingApprovals(userId, filter),
        this.db.from('products').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);

    const completed = sales.filter((s) => s.status === 'completed');
    const visibleAccounts = filter === 'all' ? accounts : accounts.filter((a) => a.id === filter);

    const alerts: Alert[] = visibleAccounts
      .filter((a) => a.status === 'needs_attention' || a.status === 'disconnected')
      .map((a) => ({
        id: `alert-account-${a.id}`,
        severity: a.status === 'disconnected' ? ('critical' as const) : ('warning' as const),
        title: `La cuenta «${a.name}» requiere atención`,
        detail: a.attentionReason ?? 'Revisa el estado de conexión de esta cuenta.',
        accountId: a.id,
      }));

    const needsReview = listings.filter((l) => l.status === 'needs_attention').length;
    if (needsReview > 0) {
      alerts.push({
        id: 'alert-listings-review',
        severity: 'warning',
        title: `${needsReview} anuncio(s) requieren revisión`,
        detail: 'Hay anuncios con información incompleta o desactualizada.',
        accountId: null,
      });
    }

    return {
      totalProducts: products.count ?? 0,
      totalListings: listings.length,
      activeListings: listings.filter((l) => l.status === 'active').length,
      draftListings: listings.filter((l) => l.status === 'draft').length,
      pendingReviewListings: listings.filter((l) => l.status === 'pending_review').length,
      pendingMessages: conversations.filter((c) => c.status === 'pending').length,
      sales: completed.length,
      revenueCents: completed.reduce((sum, s) => sum + s.priceCents, 0),
      recentActivity,
      accounts: visibleAccounts,
      alerts,
      pendingApprovals,
    };
  }

  async listActivity(userId: UserId, filter: AccountFilter, limit = 20): Promise<ActivityLog[]> {
    let query = this.db
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Los eventos sin cuenta (account_id nulo) son globales y siempre visibles.
    if (filter !== 'all') query = query.or(`account_id.eq.${filter},account_id.is.null`);

    const rows = unwrap(await query, 'la actividad') as any[];
    return rows.map(toActivity);
  }

  async logActivity(
    userId: UserId,
    input: Omit<ActivityLog, 'id' | 'userId' | 'createdAt'>,
  ): Promise<void> {
    const { error } = await this.db.from('activity_logs').insert({
      user_id: userId,
      account_id: input.accountId,
      kind: input.kind,
      message: input.message,
    });
    // La actividad es telemetría: si falla, no debe tumbar la acción principal.
    if (error) console.error('No se pudo registrar la actividad:', error.message);
  }

  async listPendingApprovals(userId: UserId, filter: AccountFilter): Promise<PendingApproval[]> {
    const rows = unwrap(
      await this.scoped(
        this.db
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
          .is('approved_at', null)
          .order('created_at', { ascending: false }),
        filter,
      ),
      'las tareas pendientes',
    ) as any[];

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      kind: row.kind,
      subjectId: row.subject_id,
      summary: row.summary,
      createdAt: row.created_at,
    }));
  }
}
