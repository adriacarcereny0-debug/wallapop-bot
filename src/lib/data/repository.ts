import type {
  Account,
  AccountFilter,
  AccountWithStats,
  ActivityLog,
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

/**
 * Contrato de acceso a datos.
 *
 * Todo método recibe `userId` como primer argumento: el aislamiento entre
 * usuarios no es deducible del contexto, se pasa siempre. Los métodos que
 * operan sobre entidades de cuenta aceptan además un `AccountFilter`, de modo
 * que «todas las cuentas» es un caso explícito y no un olvido.
 */
export interface Repository {
  // ── Cuentas ───────────────────────────────────────────────────────────────
  listAccounts(userId: UserId): Promise<AccountWithStats[]>;
  getAccount(userId: UserId, accountId: string): Promise<Account | null>;
  createAccount(userId: UserId, input: { name: string }): Promise<Account>;
  renameAccount(userId: UserId, accountId: string, name: string): Promise<Account>;
  deleteAccount(userId: UserId, accountId: string): Promise<void>;

  /** Guarda los tokens OAuth ya cifrados y marca la cuenta como conectada. */
  saveAccountTokens(
    userId: UserId,
    accountId: string,
    tokens: { accessTokenEncrypted: string; refreshTokenEncrypted: string; expiresAt: string },
  ): Promise<void>;

  /** Lee los tokens cifrados de una cuenta. `null` si no está conectada. */
  getAccountTokens(
    userId: UserId,
    accountId: string,
  ): Promise<{
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string;
    expiresAt: string;
  } | null>;

  disconnectAccount(userId: UserId, accountId: string): Promise<void>;
  flagAccount(userId: UserId, accountId: string, reason: string): Promise<void>;
  touchAccountSync(userId: UserId, accountId: string): Promise<void>;

  // ── Productos ─────────────────────────────────────────────────────────────
  listProducts(userId: UserId): Promise<Product[]>;
  getProduct(userId: UserId, productId: string): Promise<Product | null>;
  createProduct(userId: UserId, input: NewProduct): Promise<Product>;
  updateProduct(userId: UserId, productId: string, patch: Partial<NewProduct>): Promise<Product>;
  deleteProduct(userId: UserId, productId: string): Promise<void>;

  addProductImage(userId: UserId, input: NewProductImage): Promise<ProductImage>;
  deleteProductImage(userId: UserId, imageId: string): Promise<void>;

  // ── Anuncios ──────────────────────────────────────────────────────────────
  listListings(userId: UserId, filter: AccountFilter): Promise<Listing[]>;
  getListing(userId: UserId, listingId: string): Promise<Listing | null>;
  createListing(userId: UserId, input: NewListing): Promise<Listing>;
  updateListing(userId: UserId, listingId: string, patch: ListingPatch): Promise<Listing>;
  deleteListing(userId: UserId, listingId: string): Promise<void>;

  // ── Conversaciones ────────────────────────────────────────────────────────
  listConversations(userId: UserId, filter: AccountFilter): Promise<Conversation[]>;
  getConversation(userId: UserId, conversationId: string): Promise<Conversation | null>;
  createConversation(userId: UserId, input: NewConversation): Promise<Conversation>;
  updateConversation(
    userId: UserId,
    conversationId: string,
    patch: { status?: Conversation['status']; priority?: Conversation['priority']; lastOfferCents?: number | null },
  ): Promise<void>;
  appendMessage(
    userId: UserId,
    conversationId: string,
    input: { role: Message['role']; body: string },
  ): Promise<Message>;

  // ── Ventas ────────────────────────────────────────────────────────────────
  listSales(userId: UserId, filter: AccountFilter): Promise<Sale[]>;
  createSale(userId: UserId, input: NewSale): Promise<Sale>;

  // ── Panel, actividad y aprobaciones ───────────────────────────────────────
  getDashboardSummary(userId: UserId, filter: AccountFilter): Promise<DashboardSummary>;
  listActivity(userId: UserId, filter: AccountFilter, limit?: number): Promise<ActivityLog[]>;
  logActivity(userId: UserId, input: Omit<ActivityLog, 'id' | 'userId' | 'createdAt'>): Promise<void>;
  listPendingApprovals(userId: UserId, filter: AccountFilter): Promise<PendingApproval[]>;
  createApproval(userId: UserId, input: NewApproval): Promise<void>;
  resolveApproval(userId: UserId, approvalId: string): Promise<void>;

  /** Coste de IA consumido hoy por el usuario, en céntimos. Para el tope diario. */
  getTodayAiCostCents(userId: UserId): Promise<number>;
  recordAiUsage(userId: UserId, input: NewAiUsage): Promise<void>;
}

export interface NewProduct {
  name: string;
  brand: string | null;
  model: string | null;
  category: string;
  subcategory: string | null;
  condition: Product['condition'];
  purchasePriceCents: number | null;
  targetPriceCents: number | null;
  minPriceCents: number | null;
  internalDescription: string | null;
  publicDescription: string | null;
  features: Record<string, string>;
  sku: string;
  stock: number;
  internalNotes: string | null;
}

export interface NewProductImage {
  productId: string;
  url: string;
  kind: ProductImage['kind'];
  alt: string;
  transformation: string | null;
  position: number;
}

export interface NewListing {
  accountId: string;
  productId: string;
  title: string;
  description: string;
  priceCents: number;
  status: Listing['status'];
  categoryLeafId: string | null;
  hashtags: string[];
}

/** Campos actualizables de un anuncio, incluidos los que sólo toca la integración. */
export interface ListingPatch extends Partial<NewListing> {
  externalItemId?: string | null;
  publishedAt?: string | null;
  attentionReason?: string | null;
  lastOptimizedAt?: string | null;
}

export interface NewConversation {
  accountId: string;
  listingId: string | null;
  buyerAlias: string;
  priority: Conversation['priority'];
  firstMessage: string;
}

export interface NewSale {
  accountId: string;
  productId: string;
  listingId: string | null;
  buyerAlias: string | null;
  priceCents: number;
  status: Sale['status'];
  method: Sale['method'];
  notes: string | null;
}

export interface NewApproval {
  accountId: string;
  kind: PendingApproval['kind'];
  subjectId: string;
  summary: string;
}

export interface NewAiUsage {
  accountId: string | null;
  fn: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  ok: boolean;
  error: string | null;
}

/** Aplica el filtro de cuenta a cualquier entidad que lleve `accountId`. */
export function matchesAccount<T extends { accountId: string }>(
  entity: T,
  filter: AccountFilter,
): boolean {
  return filter === 'all' || entity.accountId === filter;
}
