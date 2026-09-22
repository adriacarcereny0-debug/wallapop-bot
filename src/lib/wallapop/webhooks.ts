import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verificación de webhooks de Wallapop Connect.
 *
 * Contrato documentado:
 *   · Cabeceras `X-Wallapop-Signature` y `X-Wallapop-Timestamp`.
 *   · Firma = HMAC-SHA256 de `"<payload>:<timestamp>"` con el token del webhook.
 *   · El timestamp (epoch en milisegundos) cambia en cada petición para impedir
 *     reenvíos.
 */

export const SIGNATURE_HEADER = 'x-wallapop-signature';
export const TIMESTAMP_HEADER = 'x-wallapop-timestamp';

/** Ventana de tolerancia para el timestamp. Fuera de ella, se rechaza. */
export const MAX_SKEW_MS = 5 * 60 * 1000;

export type VerificationResult =
  | { ok: true }
  | { ok: false; reason: 'missing_headers' | 'bad_timestamp' | 'expired' | 'bad_signature' };

/**
 * Verifica la autenticidad de una entrega.
 *
 * `rawBody` debe ser el cuerpo **exacto** recibido, sin reserializar: cualquier
 * cambio de espaciado invalida la firma.
 */
export function verifyWebhook(params: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  token: string;
  now?: number;
}): VerificationResult {
  const { rawBody, signature, timestamp, token, now = Date.now() } = params;

  if (!signature || !timestamp) return { ok: false, reason: 'missing_headers' };

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) return { ok: false, reason: 'bad_timestamp' };
  if (Math.abs(now - sentAt) > MAX_SKEW_MS) return { ok: false, reason: 'expired' };

  const expected = createHmac('sha256', token).update(`${rawBody}:${timestamp}`).digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  return { ok: true };
}

/** Eventos que publica Wallapop Connect. */
export const WEBHOOK_EVENTS = [
  'SALE_COMPLETED',
  'ITEM_BANNED',
  'ITEM_OUT_OF_STOCK',
  'ITEM_INACTIVATED',
  'ITEM_LISTED',
  'ITEM_RETURNED',
  'DELIVERY_REQUEST_STARTED',
  'DELIVERY_REQUEST_CANCELLED',
  'DELIVERY_REQUEST_FAILED',
  'DELIVERY_REQUEST_EXPIRED',
  'TRANSACTION_CREATED',
  'DISPUTE_CREATED',
  'DISPUTE_QUALITY_CHECK_STARTED',
  'DISPUTE_QUALITY_CHECK_EXPIRED',
  'DISPUTE_QUALITY_CHECK_APPROVED_BY_SELLER',
  'DISPUTE_ISSUE_REPORTED_BY_SELLER',
  'DISPUTE_CANCELLED_BY_WALLAPOP',
  /** Avisa de que un comprador ha abierto un chat. NO incluye el mensaje. */
  'CHAT_LEAD_CREATED',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookPayload {
  /** Identificador estable entre reintentos: sirve para deduplicar. */
  id: string;
  type: WebhookEvent;
  /** Epoch en milisegundos. */
  occurred_on: number;
  data: Record<string, unknown>;
}
