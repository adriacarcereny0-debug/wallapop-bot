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
import type {
  ListingPatch,
  NewAiUsage,
  NewApproval,
  NewConversation,
  NewListing,
  NewProduct,
  NewProductImage,
  NewSale,
  Repository,
} from './repository';

/* eslint-disable @typescript-eslint/no-explicit-any -- las filas llegan sin
   tipar desde Supabase; se convierten a tipos de dominio en los mapeadores. */

// ── Mapeadores fila → dominio ────────────────────────────────────────────────

function toAccount(row: any): Account {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    status: row.status,
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

function toApproval(row: any): PendingApproval {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    kind: row.kind,
    subjectId: row.subject_id,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

/** Error de base de datos con contexto legible. */
export class DataError extends Error {
  constructor(what: string, cause: string) {
    super(`No se pudo ${what}: ${cause}`);
    this.name = 'DataError';
  }
}

function unwrap<T>(
  result: { data: T | null; error: { message: string } | null },
  what: string,
): T {
  if (result.error) throw new DataError(what, result.error.message);
  if (result.data === null) throw new DataError(what, 'no se devolvieron datos');
  return result.data;
}

function assertOk(result: { error: { message: string } | null }, what: string): void {
  if (result.error) throw new DataError(what, result.error.message);
}

/**
 * Implementación sobre Supabase/PostgreSQL.
 *
 * Todas las consultas filtran por `user_id` **además** de confiar en RLS. Es
 * redundante a propósito: si una política se rompiera, el filtro sigue ahí.
 */
export class SupabaseRepository implements Repository {
  constructor(private readonly db: SupabaseClient) {}

  private scoped(query: any, filter: AccountFilter) {
    return filter === 'all' ? query : query.eq('account_id', filter);
  }

  // ── Cuentas ───────────────────────────────────────────────────────────────

  async listAccounts(userId: UserId): Promise<AccountWithStats[]> {
    const rows = unwrap(
      await this.db.from('accounts').select('*').eq('user_id', userId).order('created_at'),
      'leer las cuentas',
    ) as any[];

    const accounts = rows.map(toAccount);

    const stats = await Promise.all(
      accounts.map(async (account) => {
        const [listings, active, pending, sales] = await Promise.all([
          this.count('listings', userId, account.id),
          this.count('listings', userId, account.id, (q: any) => q.eq('status', 'active')),
          this.count('conversations', userId, account.id, (q: any) => q.eq('status', 'pending')),
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

  async createAccount(userId: UserId, input: { name: string }): Promise<Account> {
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
          status: 'disconnected',
          is_demo: false,
          attention_reason: 'Pendiente de conectar con Wallapop',
        })
        .select()
        .single(),
      'crear la cuenta',
    );
    return toAccount(row);
  }

  async renameAccount(userId: UserId, accountId: string, name: string): Promise<Account> {
    const row = unwrap(
      await this.db
        .from('accounts')
        .update({ name })
        .eq('user_id', userId)
        .eq('id', accountId)
        .select()
        .single(),
      'renombrar la cuenta',
    );
    return toAccount(row);
  }

  async deleteAccount(userId: UserId, accountId: string): Promise<void> {
    assertOk(
      await this.db.from('accounts').delete().eq('user_id', userId).eq('id', accountId),
      'eliminar la cuenta',
    );
  }

  async saveAccountTokens(
    userId: UserId,
    accountId: string,
    tokens: { accessTokenEncrypted: string; refreshTokenEncrypted: string; expiresAt: string },
  ): Promise<void> {
    assertOk(
      await this.db
        .from('accounts')
        .update({
          oauth_access_token_encrypted: tokens.accessTokenEncrypted,
          oauth_refresh_token_encrypted: tokens.refreshTokenEncrypted,
          oauth_expires_at: tokens.expiresAt,
          status: 'connected',
          attention_reason: null,
          last_synced_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('id', accountId),
      'guardar los tokens de la cuenta',
    );
  }

  async getAccountTokens(userId: UserId, accountId: string) {
    const { data } = await this.db
      .from('accounts')
      .select('oauth_access_token_encrypted, oauth_refresh_token_encrypted, oauth_expires_at')
      .eq('user_id', userId)
      .eq('id', accountId)
      .maybeSingle();

    if (!data?.oauth_access_token_encrypted || !data.oauth_refresh_token_encrypted) return null;

    return {
      accessTokenEncrypted: data.oauth_access_token_encrypted as string,
      refreshTokenEncrypted: data.oauth_refresh_token_encrypted as string,
      expiresAt: (data.oauth_expires_at as string | null) ?? new Date(0).toISOString(),
    };
  }

  async disconnectAccount(userId: UserId, accountId: string): Promise<void> {
    assertOk(
      await this.db
        .from('accounts')
        .update({
          oauth_access_token_encrypted: null,
          oauth_refresh_token_encrypted: null,
          oauth_expires_at: null,
          status: 'disconnected',
          attention_reason: 'Desconectada por el usuario',
        })
        .eq('user_id', userId)
        .eq('id', accountId),
      'desconectar la cuenta',
    );
  }

  async flagAccount(userId: UserId, accountId: string, reason: string): Promise<void> {
    assertOk(
      await this.db
        .from('accounts')
        .update({ status: 'needs_attention', attention_reason: reason })
        .eq('user_id', userId)
        .eq('id', accountId),
      'marcar la cuenta',
    );
  }

  async touchAccountSync(userId: UserId, accountId: string): Promise<void> {
    await this.db
      .from('accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', accountId);
  }

  // ── Productos ─────────────────────────────────────────────────────────────

  async listProducts(userId: UserId): Promise<Product[]> {
    const rows = unwrap(
      await this.db
        .from('products')
        .select('*, product_images(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      'leer los productos',
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
        .insert({ user_id: userId, ...productColumns(input) })
        .select('*, product_images(*)')
        .single(),
      'crear el producto',
    );
    return toProduct(row);
  }

  async updateProduct(
    userId: UserId,
    productId: string,
    patch: Partial<NewProduct>,
  ): Promise<Product> {
    const row = unwrap(
      await this.db
        .from('products')
        .update(productColumns(patch))
        .eq('user_id', userId)
        .eq('id', productId)
        .select('*, product_images(*)')
        .single(),
      'actualizar el producto',
    );
    return toProduct(row);
  }

  async deleteProduct(userId: UserId, productId: string): Promise<void> {
    assertOk(
      await this.db.from('products').delete().eq('user_id', userId).eq('id', productId),
      'eliminar el producto',
    );
  }

  async addProductImage(userId: UserId, input: NewProductImage): Promise<ProductImage> {
    const row = unwrap(
      await this.db
        .from('product_images')
        .insert({
          user_id: userId,
          product_id: input.productId,
          url: input.url,
          kind: input.kind,
          alt: input.alt,
          transformation: input.transformation,
          position: input.position,
        })
        .select()
        .single(),
      'guardar la imagen',
    );
    return toProductImage(row);
  }

  async deleteProductImage(userId: UserId, imageId: string): Promise<void> {
    assertOk(
      await this.db.from('product_images').delete().eq('user_id', userId).eq('id', imageId),
      'eliminar la imagen',
    );
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
      'leer los anuncios',
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
      'crear el anuncio',
    );
    return toListing(row);
  }

  async updateListing(
    userId: UserId,
    listingId: string,
    patch: ListingPatch,
  ): Promise<Listing> {
    const payload: Record<string, unknown> = {};
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.priceCents !== undefined) payload.price_cents = patch.priceCents;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.categoryLeafId !== undefined) payload.category_leaf_id = patch.categoryLeafId;
    if (patch.hashtags !== undefined) payload.hashtags = patch.hashtags;
    if (patch.accountId !== undefined) payload.account_id = patch.accountId;
    if (patch.externalItemId !== undefined) payload.external_item_id = patch.externalItemId;
    if (patch.publishedAt !== undefined) payload.published_at = patch.publishedAt;
    if (patch.attentionReason !== undefined) payload.attention_reason = patch.attentionReason;
    if (patch.lastOptimizedAt !== undefined) payload.last_optimized_at = patch.lastOptimizedAt;

    const row = unwrap(
      await this.db
        .from('listings')
        .update(payload)
        .eq('user_id', userId)
        .eq('id', listingId)
        .select()
        .single(),
      'actualizar el anuncio',
    );
    return toListing(row);
  }

  async deleteListing(userId: UserId, listingId: string): Promise<void> {
    assertOk(
      await this.db.from('listings').delete().eq('user_id', userId).eq('id', listingId),
      'eliminar el anuncio',
    );
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
      'leer las conversaciones',
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

  async createConversation(userId: UserId, input: NewConversation): Promise<Conversation> {
    const row = unwrap(
      await this.db
        .from('conversations')
        .insert({
          user_id: userId,
          account_id: input.accountId,
          listing_id: input.listingId,
          buyer_alias: input.buyerAlias,
          priority: input.priority,
          status: 'pending',
        })
        .select()
        .single(),
      'crear la conversación',
    );

    const conversation = toConversation(row);
    await this.appendMessage(userId, conversation.id, {
      role: 'buyer',
      body: input.firstMessage,
    });

    return (await this.getConversation(userId, conversation.id)) ?? conversation;
  }

  async updateConversation(
    userId: UserId,
    conversationId: string,
    patch: {
      status?: Conversation['status'];
      priority?: Conversation['priority'];
      lastOfferCents?: number | null;
    },
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.priority !== undefined) payload.priority = patch.priority;
    if (patch.lastOfferCents !== undefined) payload.last_offer_cents = patch.lastOfferCents;

    assertOk(
      await this.db
        .from('conversations')
        .update(payload)
        .eq('user_id', userId)
        .eq('id', conversationId),
      'actualizar la conversación',
    );
  }

  async appendMessage(
    userId: UserId,
    conversationId: string,
    input: { role: Message['role']; body: string },
  ): Promise<Message> {
    // Comprobación explícita de pertenencia antes de escribir.
    const { data: owned } = await this.db
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('id', conversationId)
      .maybeSingle();
    if (!owned) throw new DataError('añadir el mensaje', 'conversación no encontrada');

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
      'crear el mensaje',
    );

    // Mantiene el orden por actividad en la lista de conversaciones.
    await this.db
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', conversationId);

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
      'leer las ventas',
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
      'registrar la venta',
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
        this.listActivity(userId, filter, 8),
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

    // Los eventos sin cuenta son globales y siempre visibles.
    if (filter !== 'all') query = query.or(`account_id.eq.${filter},account_id.is.null`);

    const rows = unwrap(await query, 'leer la actividad') as any[];
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
    // La actividad es telemetría: si falla no debe tumbar la acción principal.
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
      'leer las tareas pendientes',
    ) as any[];
    return rows.map(toApproval);
  }

  async createApproval(userId: UserId, input: NewApproval): Promise<void> {
    assertOk(
      await this.db.from('tasks').insert({
        user_id: userId,
        account_id: input.accountId,
        kind: input.kind,
        subject_id: input.subjectId,
        summary: input.summary,
      }),
      'crear la tarea pendiente',
    );
  }

  async resolveApproval(userId: UserId, approvalId: string): Promise<void> {
    assertOk(
      await this.db
        .from('tasks')
        .update({ approved_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('id', approvalId),
      'aprobar la tarea',
    );
  }

  // ── Consumo de IA ─────────────────────────────────────────────────────────

  async getTodayAiCostCents(userId: UserId): Promise<number> {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);

    const { data } = await this.db
      .from('ai_generations')
      .select('cost_cents')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString());

    return ((data ?? []) as { cost_cents: number }[]).reduce((sum, r) => sum + r.cost_cents, 0);
  }

  async recordAiUsage(userId: UserId, input: NewAiUsage): Promise<void> {
    const { error } = await this.db.from('ai_generations').insert({
      user_id: userId,
      account_id: input.accountId,
      fn: input.fn,
      provider: input.provider,
      model: input.model,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      cost_cents: input.costCents,
      ok: input.ok,
      error: input.error,
    });
    if (error) console.error('No se pudo registrar el consumo de IA:', error.message);
  }
}

/** Traduce los campos de producto del dominio a columnas de base de datos. */
function productColumns(input: Partial<NewProduct>): Record<string, unknown> {
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

  const columns: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(map)) {
    const value = input[key as keyof NewProduct];
    if (value !== undefined) columns[column] = value;
  }
  return columns;
}
