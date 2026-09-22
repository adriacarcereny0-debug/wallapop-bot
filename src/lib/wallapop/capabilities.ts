/**
 * Mapa de capacidades de la integración con Wallapop.
 *
 * ESTE FICHERO ES LA ÚNICA FUENTE DE VERDAD sobre qué puede automatizar la
 * aplicación. La interfaz lo consulta para decidir si ofrece una acción, la
 * ofrece con confirmación humana, o la explica como no disponible.
 *
 * Añadir una capacidad nueva obliga a pasar por aquí y a justificarla con su
 * endpoint oficial. Es deliberado: hace imposible colar una automatización sin
 * respaldo documental.
 *
 * Fuente: docs/WALLAPOP_INTEGRATION.md y reference/wallapop-openapi/.
 */

export type CapabilityLevel =
  /** Hay endpoint oficial y puede ejecutarse (tras confirmación del usuario). */
  | 'official'
  /** Hay endpoint oficial, pero requiere Wallapop Pro. */
  | 'official_requires_pro'
  /** No hay API. La app sólo prepara y asiste; la ejecución es manual. */
  | 'assisted_only'
  /** No se implementa: incumpliría las condiciones de Wallapop. */
  | 'not_permitted';

export interface Capability {
  id: string;
  /** Qué pidió el cliente, en sus términos. */
  request: string;
  level: CapabilityLevel;
  /** Endpoint oficial, cuando existe. */
  endpoint: string | null;
  /** Explicación que se muestra al usuario en la interfaz. */
  explanation: string;
  /** Qué hace la aplicación en su lugar cuando no hay automatización. */
  alternative: string | null;
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'listing.create',
    request: 'Crear y publicar anuncios',
    level: 'official',
    endpoint: 'POST /items',
    explanation:
      'La Items Connect API permite crear y publicar anuncios de forma oficial.',
    alternative: null,
  },
  {
    id: 'listing.update',
    request: 'Modificar anuncios',
    level: 'official',
    endpoint: 'PUT /items/{itemId}',
    explanation: 'La modificación de anuncios está cubierta por la API oficial.',
    alternative: null,
  },
  {
    id: 'listing.images',
    request: 'Gestionar las fotos del anuncio',
    level: 'official',
    endpoint: 'POST /items/{itemId}/images · DELETE /items/{itemId}/images/{imageId}',
    explanation: 'Añadir y eliminar imágenes está cubierto por la API oficial.',
    alternative: null,
  },
  {
    id: 'listing.mark_sold',
    request: 'Marcar un anuncio como vendido',
    level: 'official',
    endpoint: 'PUT /items/{id}/sold',
    explanation: 'Operación oficial que además mantiene coherente el historial de ventas.',
    alternative: null,
  },
  {
    id: 'listing.rotate',
    request: 'Rotar anuncios para ganar visibilidad',
    level: 'official_requires_pro',
    endpoint: 'PUT /items/{id}/activate · PUT /items/{id}/inactivate · GET /items/limits',
    explanation:
      'No existe ningún endpoint de republicación, renovación ni «bump». Lo único ' +
      'oficial es activar y desactivar anuncios contra el límite de plazas de tu ' +
      'suscripción, y requiere Wallapop Pro.',
    alternative:
      'La aplicación planifica qué anuncios conviene revisar y prepara la ' +
      'modificación, pero no republica en bucle para forzar visibilidad.',
  },
  {
    id: 'transaction.shipping',
    request: 'Gestionar envíos y transacciones',
    level: 'official',
    endpoint: 'GET /transactions/... · POST /transactions/requests/{id}/accept/...',
    explanation: 'La Transactions Connect API cubre el ciclo de envío completo.',
    alternative: null,
  },
  {
    id: 'webhooks',
    request: 'Recibir avisos de eventos',
    level: 'official',
    endpoint: 'POST /webhooks',
    explanation:
      'Wallapop notifica eventos de anuncio, envío, transacción y disputa mediante ' +
      'webhooks firmados con HMAC-SHA256.',
    alternative: null,
  },
  {
    id: 'messaging.read',
    request: 'Leer los mensajes de los compradores',
    level: 'assisted_only',
    endpoint: null,
    explanation:
      'Wallapop NO publica ninguna API de mensajería. El único evento relacionado es ' +
      '«CHAT_LEAD_CREATED», que avisa de que existe un chat pero no entrega su contenido.',
    alternative:
      'Registra la conversación en la aplicación para que la IA pueda analizarla y ' +
      'proponerte una respuesta.',
  },
  {
    id: 'messaging.send',
    request: 'Responder automáticamente a los compradores',
    level: 'assisted_only',
    endpoint: null,
    explanation:
      'Sin API de mensajería no hay forma autorizada de enviar mensajes. No se ha ' +
      'implementado ninguna vía alternativa, porque cualquiera de ellas incumpliría ' +
      'las condiciones de Wallapop.',
    alternative:
      'La IA redacta el borrador, tú lo revisas y lo copias para enviarlo desde Wallapop.',
  },
  {
    id: 'negotiation.auto_accept',
    request: 'Aceptar ofertas automáticamente',
    level: 'assisted_only',
    endpoint: null,
    explanation:
      'No existe API de ofertas ni de chat, de modo que no hay manera oficial de ' +
      'aceptar o rechazar una oferta por programa.',
    alternative:
      'El asistente calcula contraofertas contra tu objetivo y tu mínimo, y te ' +
      'recomienda. La decisión y la ejecución siguen siendo tuyas.',
  },
  {
    id: 'analytics.views',
    request: 'Ver estadísticas de visualizaciones del anuncio',
    level: 'assisted_only',
    endpoint: null,
    explanation: 'Wallapop no expone métricas de visualizaciones ni de favoritos por API.',
    alternative:
      'La aplicación registra métricas propias (anuncios, estados, ventas, actividad) ' +
      'y puntúa la calidad del anuncio, sin prometer visitas.',
  },
  {
    id: 'account.auto_create',
    request: 'Crear cuentas de Wallapop automáticamente',
    level: 'not_permitted',
    endpoint: null,
    explanation:
      'Crear cuentas por programa incumple las condiciones de uso. No se implementa.',
    alternative: 'Crea las cuentas manualmente y conéctalas por OAuth desde «Cuentas».',
  },
  {
    id: 'scraping',
    request: 'Extraer datos de Wallapop sin API',
    level: 'not_permitted',
    endpoint: null,
    explanation:
      'Scraping, automatización de navegador para saltar restricciones, resolución de ' +
      'CAPTCHA, suplantación de huella digital y rotación de proxies quedan fuera del ' +
      'proyecto. No se ha escrito código para ninguna de estas técnicas.',
    alternative: 'Se usa exclusivamente la Wallapop Connect API oficial.',
  },
] as const;

const BY_ID = new Map(CAPABILITIES.map((c) => [c.id, c]));

export function getCapability(id: string): Capability | undefined {
  return BY_ID.get(id);
}

/** `true` si la operación puede ejecutarse contra la API oficial. */
export function isAutomatable(id: string): boolean {
  const level = BY_ID.get(id)?.level;
  return level === 'official' || level === 'official_requires_pro';
}

export const CAPABILITY_LABELS: Record<CapabilityLevel, string> = {
  official: 'API oficial',
  official_requires_pro: 'API oficial · requiere Wallapop Pro',
  assisted_only: 'Sólo asistido',
  not_permitted: 'No permitido',
};
