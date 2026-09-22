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
  Sale,
  UserId,
} from '@/types/domain';

/**
 * Contrato único de acceso a datos.
 *
 * Todo método recibe `userId` como primer argumento: el aislamiento entre
 * usuarios no es opcional ni deducible del contexto. Los métodos que operan
 * sobre entidades de cuenta aceptan además un `AccountFilter`, de modo que
 * "todas las cuentas" es un caso explícito y no un olvido.
 *
 * Implementaciones: `DemoRepository` (en memoria) y `SupabaseRepository`.
 */
export interface Repository {
  // Cuentas
  listAccounts(userId: UserId): Promise<AccountWithStats[]>;
  getAccount(userId: UserId, accountId: string): Promise<Account | null>;
  createAccount(userId: UserId, input: { name: string; isDemo: boolean }): Promise<Account>;

  // Productos
  listProducts(userId: UserId): Promise<Product[]>;
  getProduct(userId: UserId, productId: string): Promise<Product | null>;
  createProduct(userId: UserId, input: NewProduct): Promise<Product>;
  updateProduct(userId: UserId, productId: string, patch: Partial<NewProduct>): Promise<Product>;

  // Anuncios
  listListings(userId: UserId, filter: AccountFilter): Promise<Listing[]>;
  getListing(userId: UserId, listingId: string): Promise<Listing | null>;
  createListing(userId: UserId, input: NewListing): Promise<Listing>;
  updateListing(userId: UserId, listingId: string, patch: Partial<NewListing>): Promise<Listing>;

  // Conversaciones
  listConversations(userId: UserId, filter: AccountFilter): Promise<Conversation[]>;
  getConversation(userId: UserId, conversationId: string): Promise<Conversation | null>;
  appendMessage(
    userId: UserId,
    conversationId: string,
    input: { role: Message['role']; body: string },
  ): Promise<Message>;

  // Ventas
  listSales(userId: UserId, filter: AccountFilter): Promise<Sale[]>;
  createSale(userId: UserId, input: NewSale): Promise<Sale>;

  // Panel y actividad
  getDashboardSummary(userId: UserId, filter: AccountFilter): Promise<DashboardSummary>;
  listActivity(userId: UserId, filter: AccountFilter, limit?: number): Promise<ActivityLog[]>;
  logActivity(userId: UserId, input: Omit<ActivityLog, 'id' | 'userId' | 'createdAt'>): Promise<void>;

  // Aprobaciones pendientes
  listPendingApprovals(userId: UserId, filter: AccountFilter): Promise<PendingApproval[]>;
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

/** Aplica el filtro de cuenta a cualquier entidad que lleve `accountId`. */
export function matchesAccount<T extends { accountId: string }>(
  entity: T,
  filter: AccountFilter,
): boolean {
  return filter === 'all' || entity.accountId === filter;
}
