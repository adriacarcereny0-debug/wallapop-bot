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
  Sale,
  UserId,
} from '@/types/domain';
import {
  demoAccounts,
  demoActivity,
  demoApprovals,
  demoConversations,
  demoListings,
  demoProducts,
  demoSales,
} from './demo-seed';
import { matchesAccount, type NewListing, type NewProduct, type NewSale, type Repository } from './repository';

/** Copia profunda barata y segura para los tipos planos del dominio. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Repositorio en memoria para el modo demo.
 *
 * Mantiene el estado por proceso: en desarrollo sobrevive entre peticiones, y en
 * serverless se reinicia con cada instancia fría. Es aceptable y buscado — el
 * modo demo sirve para explorar la interfaz, no para almacenar datos reales.
 */
export class DemoRepository implements Repository {
  private accounts: Account[] = clone(demoAccounts);
  private products: Product[] = clone(demoProducts);
  private listings: Listing[] = clone(demoListings);
  private conversations: Conversation[] = clone(demoConversations);
  private sales: Sale[] = clone(demoSales);
  private activity: ActivityLog[] = clone(demoActivity);
  private approvals: PendingApproval[] = clone(demoApprovals);

  // ── Cuentas ───────────────────────────────────────────────────────────────

  async listAccounts(userId: UserId): Promise<AccountWithStats[]> {
    return this.accounts
      .filter((a) => a.userId === userId)
      .map((account) => ({ ...account, stats: this.statsFor(account.id) }));
  }

  async getAccount(userId: UserId, accountId: string): Promise<Account | null> {
    return this.accounts.find((a) => a.userId === userId && a.id === accountId) ?? null;
  }

  async createAccount(userId: UserId, input: { name: string; isDemo: boolean }): Promise<Account> {
    const index = this.accounts.filter((a) => a.userId === userId).length + 1;
    const account: Account = {
      id: randomId('acc'),
      userId,
      name: input.name,
      slug: `cuenta-${String(index).padStart(2, '0')}`,
      status: input.isDemo ? 'demo' : 'disconnected',
      isDemo: input.isDemo,
      lastSyncedAt: null,
      attentionReason: input.isDemo ? null : 'Pendiente de autorizar con Wallapop',
      createdAt: new Date().toISOString(),
    };
    this.accounts.push(account);
    return account;
  }

  private statsFor(accountId: string) {
    const listings = this.listings.filter((l) => l.accountId === accountId);
    const sales = this.sales.filter((s) => s.accountId === accountId);
    return {
      accountId,
      listings: listings.length,
      activeListings: listings.filter((l) => l.status === 'active').length,
      pendingMessages: this.conversations.filter(
        (c) => c.accountId === accountId && c.status === 'pending',
      ).length,
      sales: sales.filter((s) => s.status === 'completed').length,
      revenueCents: sales
        .filter((s) => s.status === 'completed')
        .reduce((sum, s) => sum + s.priceCents, 0),
    };
  }

  // ── Productos ─────────────────────────────────────────────────────────────

  async listProducts(userId: UserId): Promise<Product[]> {
    return this.products.filter((p) => p.userId === userId);
  }

  async getProduct(userId: UserId, productId: string): Promise<Product | null> {
    return this.products.find((p) => p.userId === userId && p.id === productId) ?? null;
  }

  async createProduct(userId: UserId, input: NewProduct): Promise<Product> {
    const now = new Date().toISOString();
    const product: Product = {
      ...input,
      id: randomId('prod'),
      userId,
      salePriceCents: null,
      images: [],
      createdAt: now,
      updatedAt: now,
    };
    this.products.push(product);
    return product;
  }

  async updateProduct(
    userId: UserId,
    productId: string,
    patch: Partial<NewProduct>,
  ): Promise<Product> {
    const product = this.products.find((p) => p.userId === userId && p.id === productId);
    if (!product) throw new Error('Producto no encontrado');
    Object.assign(product, patch, { updatedAt: new Date().toISOString() });
    return product;
  }

  // ── Anuncios ──────────────────────────────────────────────────────────────

  async listListings(userId: UserId, filter: AccountFilter): Promise<Listing[]> {
    return this.listings
      .filter((l) => l.userId === userId && matchesAccount(l, filter))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getListing(userId: UserId, listingId: string): Promise<Listing | null> {
    return this.listings.find((l) => l.userId === userId && l.id === listingId) ?? null;
  }

  async createListing(userId: UserId, input: NewListing): Promise<Listing> {
    const now = new Date().toISOString();
    const listing: Listing = {
      ...input,
      id: randomId('lst'),
      userId,
      externalItemId: null,
      attentionReason: null,
      lastOptimizedAt: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.listings.push(listing);
    return listing;
  }

  async updateListing(
    userId: UserId,
    listingId: string,
    patch: Partial<NewListing>,
  ): Promise<Listing> {
    const listing = this.listings.find((l) => l.userId === userId && l.id === listingId);
    if (!listing) throw new Error('Anuncio no encontrado');
    Object.assign(listing, patch, { updatedAt: new Date().toISOString() });
    return listing;
  }

  // ── Conversaciones ────────────────────────────────────────────────────────

  async listConversations(userId: UserId, filter: AccountFilter): Promise<Conversation[]> {
    return this.conversations
      .filter((c) => c.userId === userId && matchesAccount(c, filter))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getConversation(userId: UserId, conversationId: string): Promise<Conversation | null> {
    return this.conversations.find((c) => c.userId === userId && c.id === conversationId) ?? null;
  }

  async appendMessage(
    userId: UserId,
    conversationId: string,
    input: { role: Message['role']; body: string },
  ): Promise<Message> {
    const conversation = this.conversations.find(
      (c) => c.userId === userId && c.id === conversationId,
    );
    if (!conversation) throw new Error('Conversación no encontrada');

    const message: Message = {
      id: randomId('msg'),
      conversationId,
      role: input.role,
      body: input.body,
      used: false,
      createdAt: new Date().toISOString(),
    };
    conversation.messages.push(message);
    conversation.updatedAt = message.createdAt;
    return message;
  }

  // ── Ventas ────────────────────────────────────────────────────────────────

  async listSales(userId: UserId, filter: AccountFilter): Promise<Sale[]> {
    return this.sales
      .filter((s) => s.userId === userId && matchesAccount(s, filter))
      .sort((a, b) => b.soldAt.localeCompare(a.soldAt));
  }

  async createSale(userId: UserId, input: NewSale): Promise<Sale> {
    const now = new Date().toISOString();
    const sale: Sale = { ...input, id: randomId('sale'), userId, soldAt: now, createdAt: now };
    this.sales.push(sale);
    return sale;
  }

  // ── Panel ─────────────────────────────────────────────────────────────────

  async getDashboardSummary(userId: UserId, filter: AccountFilter): Promise<DashboardSummary> {
    const [accounts, listings, conversations, sales, recentActivity, pendingApprovals] =
      await Promise.all([
        this.listAccounts(userId),
        this.listListings(userId, filter),
        this.listConversations(userId, filter),
        this.listSales(userId, filter),
        this.listActivity(userId, filter, 6),
        this.listPendingApprovals(userId, filter),
      ]);

    const completedSales = sales.filter((s) => s.status === 'completed');
    const visibleAccounts =
      filter === 'all' ? accounts : accounts.filter((a) => a.id === filter);

    return {
      totalProducts: (await this.listProducts(userId)).length,
      totalListings: listings.length,
      activeListings: listings.filter((l) => l.status === 'active').length,
      draftListings: listings.filter((l) => l.status === 'draft').length,
      pendingReviewListings: listings.filter((l) => l.status === 'pending_review').length,
      pendingMessages: conversations.filter((c) => c.status === 'pending').length,
      sales: completedSales.length,
      revenueCents: completedSales.reduce((sum, s) => sum + s.priceCents, 0),
      recentActivity,
      accounts: visibleAccounts,
      alerts: this.buildAlerts(visibleAccounts, listings),
      pendingApprovals,
    };
  }

  private buildAlerts(accounts: AccountWithStats[], listings: Listing[]): Alert[] {
    const alerts: Alert[] = [];

    for (const account of accounts) {
      if (account.status === 'needs_attention' || account.status === 'disconnected') {
        alerts.push({
          id: `alert-account-${account.id}`,
          severity: account.status === 'disconnected' ? 'critical' : 'warning',
          title: `La cuenta «${account.name}» requiere atención`,
          detail: account.attentionReason ?? 'Revisa el estado de conexión de esta cuenta.',
          accountId: account.id,
        });
      }
    }

    const needsReview = listings.filter((l) => l.status === 'needs_attention');
    if (needsReview.length > 0) {
      alerts.push({
        id: 'alert-listings-review',
        severity: 'warning',
        title: `${needsReview.length} anuncio(s) requieren revisión`,
        detail: 'Hay anuncios con información incompleta o desactualizada.',
        accountId: null,
      });
    }

    return alerts;
  }

  async listActivity(userId: UserId, filter: AccountFilter, limit = 20): Promise<ActivityLog[]> {
    return this.activity
      .filter(
        (a) =>
          a.userId === userId &&
          (filter === 'all' || a.accountId === null || a.accountId === filter),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async logActivity(
    userId: UserId,
    input: Omit<ActivityLog, 'id' | 'userId' | 'createdAt'>,
  ): Promise<void> {
    this.activity.unshift({
      ...input,
      id: randomId('act'),
      userId,
      createdAt: new Date().toISOString(),
    });
  }

  async listPendingApprovals(userId: UserId, filter: AccountFilter): Promise<PendingApproval[]> {
    return this.approvals.filter((a) => a.userId === userId && matchesAccount(a, filter));
  }
}
