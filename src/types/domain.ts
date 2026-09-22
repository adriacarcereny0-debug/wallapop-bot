/**
 * Modelo de dominio de Wallapop Assistant.
 *
 * Regla de aislamiento multicuenta (invariante del sistema):
 *   Toda entidad que pertenezca a una cuenta de Wallapop lleva `userId` Y `accountId`.
 *   Los productos son la excepción deliberada: viven a nivel de usuario (catálogo central)
 *   y se vinculan a una cuenta sólo al crear el anuncio.
 */

// ── Identificadores ──────────────────────────────────────────────────────────
export type UserId = string;
export type AccountId = string;
export type ProductId = string;
export type ListingId = string;
export type ConversationId = string;
export type SaleId = string;

// ── Cuentas de Wallapop ──────────────────────────────────────────────────────

/**
 * Estado de conexión de una cuenta.
 * - `demo`        → cuenta ficticia, no toca ningún servicio externo.
 * - `connected`   → OAuth válido contra Wallapop Connect.
 * - `needs_attention` → token caducado, error de sincronización o límite alcanzado.
 * - `disconnected`→ sin autorización activa.
 */
export type AccountStatus = 'demo' | 'connected' | 'needs_attention' | 'disconnected';

export interface Account {
  id: AccountId;
  userId: UserId;
  /** Nombre que le da el usuario, p. ej. "Tienda principal". */
  name: string;
  /** Identificador interno legible y estable, p. ej. "cuenta-01". */
  slug: string;
  status: AccountStatus;
  /** `true` si es una cuenta de demostración con datos ficticios. */
  isDemo: boolean;
  lastSyncedAt: string | null;
  /** Motivo legible cuando `status === 'needs_attention'`. */
  attentionReason: string | null;
  createdAt: string;
}

/** Contadores derivados que muestra la tarjeta de cuenta. */
export interface AccountStats {
  accountId: AccountId;
  listings: number;
  activeListings: number;
  pendingMessages: number;
  sales: number;
  revenueCents: number;
}

export interface AccountWithStats extends Account {
  stats: AccountStats;
}

// ── Productos (catálogo central) ─────────────────────────────────────────────

export type ProductCondition =
  | 'new'
  | 'like_new'
  | 'very_good'
  | 'good'
  | 'acceptable'
  | 'for_parts';

export interface ProductImage {
  id: string;
  productId: ProductId;
  /** URL en el object storage. Nunca binarios en base de datos. */
  url: string;
  /** `original` = foto real del vendedor. `enhanced` = procesada por IA. */
  kind: 'original' | 'enhanced';
  /** Texto alternativo accesible. */
  alt: string;
  /** Si es `enhanced`, qué transformación se aplicó (trazabilidad). */
  transformation: string | null;
  position: number;
  createdAt: string;
}

export interface Product {
  id: ProductId;
  userId: UserId;
  name: string;
  brand: string | null;
  model: string | null;
  category: string;
  subcategory: string | null;
  condition: ProductCondition;
  /** Todos los precios en céntimos de euro, enteros. Nunca float para dinero. */
  purchasePriceCents: number | null;
  targetPriceCents: number | null;
  minPriceCents: number | null;
  salePriceCents: number | null;
  /** Notas privadas del vendedor; nunca se envían a Wallapop. */
  internalDescription: string | null;
  /** Descripción destinada al anuncio. */
  publicDescription: string | null;
  /** Características declaradas por el vendedor (clave → valor). */
  features: Record<string, string>;
  sku: string;
  stock: number;
  internalNotes: string | null;
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

// ── Anuncios ─────────────────────────────────────────────────────────────────

export type ListingStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'reserved'
  | 'sold'
  | 'archived'
  | 'needs_attention';

export interface Listing {
  id: ListingId;
  userId: UserId;
  /** Aislamiento multicuenta: un anuncio SIEMPRE pertenece a una cuenta. */
  accountId: AccountId;
  productId: ProductId;
  title: string;
  description: string;
  priceCents: number;
  status: ListingStatus;
  /** `category_leaf_id` de Wallapop, cuando se conoce. */
  categoryLeafId: string | null;
  /** ID del item en Wallapop tras publicarlo. `null` mientras sea borrador. */
  externalItemId: string | null;
  /** Hashtags propuestos para el anuncio. */
  hashtags: string[];
  attentionReason: string | null;
  lastOptimizedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Conversaciones (modo asistente — sin API oficial de chat) ────────────────

export type ConversationStatus = 'pending' | 'negotiating' | 'closed' | 'archived';
export type ConversationPriority = 'low' | 'normal' | 'high';

export interface Message {
  id: string;
  conversationId: ConversationId;
  /** Quién habla. `assistant` = borrador generado por IA, aún no enviado. */
  role: 'buyer' | 'seller' | 'assistant';
  body: string;
  /** Para borradores de IA: si el usuario ya lo copió/usó. */
  used: boolean;
  createdAt: string;
}

export interface Conversation {
  id: ConversationId;
  userId: UserId;
  accountId: AccountId;
  listingId: ListingId | null;
  /** Alias del comprador. Nunca se guardan datos personales innecesarios. */
  buyerAlias: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  /** Última oferta económica recibida, en céntimos. */
  lastOfferCents: number | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// ── Ventas ───────────────────────────────────────────────────────────────────

export type SaleStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type SaleMethod = 'shipping' | 'in_person' | 'other';

export interface Sale {
  id: SaleId;
  userId: UserId;
  accountId: AccountId;
  productId: ProductId;
  listingId: ListingId | null;
  buyerAlias: string | null;
  priceCents: number;
  status: SaleStatus;
  method: SaleMethod;
  notes: string | null;
  soldAt: string;
  createdAt: string;
}

// ── Actividad y auditoría ────────────────────────────────────────────────────

export type ActivityKind =
  | 'ai_generation'
  | 'listing_prepared'
  | 'listing_updated'
  | 'conversation_pending'
  | 'account_attention'
  | 'sale_recorded'
  | 'image_enhanced';

export interface ActivityLog {
  id: string;
  userId: UserId;
  /** `null` para eventos que no pertenecen a ninguna cuenta concreta. */
  accountId: AccountId | null;
  kind: ActivityKind;
  message: string;
  createdAt: string;
}

// ── Acciones pendientes de aprobación humana ─────────────────────────────────

/**
 * Nada generado por IA llega al exterior sin pasar por aquí.
 * Este tipo es el que materializa el requisito "revisión y confirmación humana".
 */
export interface PendingApproval {
  id: string;
  userId: UserId;
  accountId: AccountId;
  kind: 'listing_content' | 'listing_update' | 'reply_draft' | 'image_enhancement';
  subjectId: string;
  summary: string;
  createdAt: string;
}

// ── Filtro global por cuenta ─────────────────────────────────────────────────

/** `'all'` = todas las cuentas del usuario. Cualquier otro valor = una cuenta. */
export type AccountFilter = AccountId | 'all';

// ── Resumen del panel principal ──────────────────────────────────────────────

export interface DashboardSummary {
  totalProducts: number;
  totalListings: number;
  activeListings: number;
  draftListings: number;
  pendingReviewListings: number;
  pendingMessages: number;
  sales: number;
  revenueCents: number;
  recentActivity: ActivityLog[];
  accounts: AccountWithStats[];
  alerts: Alert[];
  pendingApprovals: PendingApproval[];
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  accountId: AccountId | null;
}
