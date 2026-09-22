import { NextResponse } from 'next/server';
import { getEnv, isWallapopConfigured } from '@/lib/config/env';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyWebhook,
  type WebhookPayload,
} from '@/lib/wallapop/webhooks';

/**
 * Receptor de webhooks de Wallapop Connect.
 *
 * Reglas:
 *  1. El cuerpo se lee EN CRUDO. Reserializarlo invalidaría la firma.
 *  2. Se verifica la firma HMAC antes de mirar el contenido.
 *  3. Se responde 2xx en cuanto la entrega es válida: si tardamos, Wallapop
 *     reintenta y duplica eventos.
 *  4. Los eventos traen un `id` estable entre reintentos, que es lo que debe
 *     usarse para deduplicar al persistirlos.
 */
export async function POST(request: Request) {
  if (!isWallapopConfigured()) {
    return NextResponse.json({ error: 'Integración no configurada.' }, { status: 404 });
  }

  const env = getEnv();

  const rawBody = await request.text();

  // En una implementación con varias cuentas, el token de firma se busca por la
  // cuenta destinataria. Aquí se usa la clave de aplicación como token único;
  // ver docs/WALLAPOP_INTEGRATION.md antes de pasar a producción.
  const token = env.WALLAPOP_CLIENT_SECRET;
  if (!token) {
    console.error('Webhook recibido sin token de verificación configurado.');
    return NextResponse.json({ error: 'No configurado.' }, { status: 500 });
  }

  const result = verifyWebhook({
    rawBody,
    signature: request.headers.get(SIGNATURE_HEADER),
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    token,
  });

  if (!result.ok) {
    // No se detalla el motivo al emisor: ayudaría a afinar un ataque.
    console.warn('Webhook rechazado:', result.reason);
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido.' }, { status: 400 });
  }

  // El procesamiento real (actualizar el anuncio, registrar la venta) va aquí.
  // Debe ser idempotente y apoyarse en `payload.id` para descartar reintentos.
  console.warn(`Webhook de Wallapop recibido: ${payload.type} (${payload.id})`);

  return NextResponse.json({ received: true });
}
