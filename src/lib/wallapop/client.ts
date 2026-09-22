import { isWallapopConfigured } from '@/lib/config/env';
import { isAutomatable } from './capabilities';

/**
 * Cliente de la Wallapop Connect API.
 *
 * Reglas de diseño:
 *  · Sólo endpoints documentados oficialmente. **No se inventa ninguno.**
 *  · Toda operación se comprueba antes contra el mapa de capacidades.
 *  · Respeta el límite de 36 peticiones/segundo por vendedor.
 *  · Si la integración está desactivada, cualquier llamada falla de inmediato
 *    con un mensaje claro, en lugar de intentar salir a la red.
 */

export const CONNECT_BASE_URL = 'https://connect.wallapop.com';

/** Límite documentado: 36 req/s por vendedor profesional. */
const MAX_REQUESTS_PER_SECOND = 36;
const MIN_INTERVAL_MS = Math.ceil(1000 / MAX_REQUESTS_PER_SECOND);

export class WallapopError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: string | null = null,
  ) {
    super(message);
    this.name = 'WallapopError';
  }
}

export class IntegrationDisabledError extends Error {
  constructor(operation: string) {
    super(
      `No hay credenciales de aplicación integradora de Wallapop, así que «${operation}» ` +
        'no puede ejecutarse. Wallapop concede esas credenciales a vendedores ' +
        'profesionales tras solicitar el alta. Consulta docs/WALLAPOP_INTEGRATION.md.',
    );
    this.name = 'IntegrationDisabledError';
  }
}

// ── Tipos de la API (derivados de las especificaciones oficiales) ────────────

export interface ConnectItemPrice {
  cash: number;
  currency: string;
}

export interface ConnectItem {
  category_leaf_id: string;
  title: string;
  description: string;
  price: ConnectItemPrice;
  attributes?: Record<string, string>;
  hashtags?: string[];
}

export interface ConnectListingLimit {
  category_ids: string[];
  total: number;
  used: number;
  available: number;
}

export interface ConnectPaginated<T> {
  data: T[];
  metadata?: { pagination?: { next: string | null } };
}

/**
 * Espaciador de peticiones: serializa las llamadas para no superar el límite.
 * Sencillo a propósito — una instancia por proceso basta para el volumen de
 * un vendedor.
 */
class RateLimiter {
  private nextSlot = 0;

  async wait(): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + MIN_INTERVAL_MS;
    if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
  }
}

const limiter = new RateLimiter();

export class WallapopConnectClient {
  constructor(private readonly accessToken: string) {
    if (!isWallapopConfigured()) {
      throw new IntegrationDisabledError('crear el cliente de Wallapop');
    }
  }

  private async request<T>(
    capabilityId: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!isAutomatable(capabilityId)) {
      throw new IntegrationDisabledError(capabilityId);
    }

    await limiter.wait();

    const response = await fetch(`${CONNECT_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Accept-Language': 'es',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => null);
      throw new WallapopError(
        `Wallapop respondió ${response.status} a ${method} ${path}`,
        response.status,
        detail,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  // ── Anuncios ──────────────────────────────────────────────────────────────

  /** `POST /items` — crear y publicar un anuncio. */
  createItem(payload: { item: ConnectItem; main_image: unknown; stock?: unknown }) {
    return this.request<{ id: string }>('listing.create', 'POST', '/items', payload);
  }

  /** `GET /items` — listar anuncios (paginación por cursor, 40/página). */
  listItems(since?: string) {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return this.request<ConnectPaginated<unknown>>('listing.create', 'GET', `/items${query}`);
  }

  /** `GET /items/inactive` — listar anuncios inactivos. */
  listInactiveItems(since?: string) {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return this.request<ConnectPaginated<unknown>>(
      'listing.rotate',
      'GET',
      `/items/inactive${query}`,
    );
  }

  /** `PUT /items/{itemId}` — modificar un anuncio. */
  updateItem(itemId: string, payload: { item: ConnectItem }) {
    return this.request<unknown>('listing.update', 'PUT', `/items/${itemId}`, payload);
  }

  /** `PUT /items/{id}/sold` — marcar como vendido. */
  markAsSold(itemId: string) {
    return this.request<unknown>('listing.mark_sold', 'PUT', `/items/${itemId}/sold`);
  }

  /**
   * `GET /items/limits` — plazas de publicación disponibles.
   *
   * Es la comprobación previa obligatoria antes de activar un anuncio: si no hay
   * plaza libre, Wallapop crea el anuncio como inactivo sin avisar.
   */
  getListingLimits() {
    return this.request<{ limits: ConnectListingLimit[] }>(
      'listing.rotate',
      'GET',
      '/items/limits',
    );
  }

  /** `PUT /items/{id}/activate` — publicar un anuncio inactivo. Requiere Pro. */
  activateItem(itemId: string) {
    return this.request<unknown>('listing.rotate', 'PUT', `/items/${itemId}/activate`);
  }

  /** `PUT /items/{id}/inactivate` — despublicar un anuncio. Requiere Pro. */
  inactivateItem(itemId: string) {
    return this.request<unknown>('listing.rotate', 'PUT', `/items/${itemId}/inactivate`);
  }

  /** `GET /items/categories` — árbol de categorías. */
  listCategories() {
    return this.request<unknown>('listing.create', 'GET', '/items/categories');
  }

  /** `GET /items/categories/{id}/attributes` — atributos de una categoría. */
  getCategoryAttributes(categoryId: string) {
    return this.request<unknown>(
      'listing.create',
      'GET',
      `/items/categories/${categoryId}/attributes`,
    );
  }

  // ── Transacciones ─────────────────────────────────────────────────────────

  /** `GET /transactions/requests/pending` — solicitudes de envío pendientes. */
  listPendingShippingRequests() {
    return this.request<unknown>('transaction.shipping', 'GET', '/transactions/requests/pending');
  }

  /** `GET /transactions/pending` — transacciones de envío en curso. */
  listPendingTransactions() {
    return this.request<unknown>('transaction.shipping', 'GET', '/transactions/pending');
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  /** `POST /webhooks` — registrar un webhook. Devuelve el token de firma. */
  createWebhook(url: string) {
    return this.request<{ id: string; token: string }>('webhooks', 'POST', '/webhooks', { url });
  }

  /** `GET /webhooks` — webhooks registrados. */
  listWebhooks() {
    return this.request<unknown>('webhooks', 'GET', '/webhooks');
  }
}

/*
 * NO EXISTE — y por tanto no se implementa:
 *   · Leer o enviar mensajes de chat.
 *   · Aceptar o rechazar ofertas.
 *   · Renovar, republicar o reposicionar un anuncio («bump»).
 *   · Consultar visualizaciones o favoritos.
 * Ver el mapa de capacidades en ./capabilities.ts.
 */
