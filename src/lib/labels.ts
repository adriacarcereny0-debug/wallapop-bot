import type {
  AccountStatus,
  ConversationStatus,
  ListingStatus,
  ProductCondition,
  SaleMethod,
  SaleStatus,
} from '@/types/domain';
import type { Tone } from '@/components/ui/primitives';

/**
 * Etiquetas y tonos de cada estado del dominio, en un único sitio.
 * Evita que la misma palabra se traduzca de tres formas distintas según la pantalla.
 */

export const ACCOUNT_STATUS: Record<AccountStatus, { label: string; tone: Tone }> = {
  demo: { label: 'Demo', tone: 'info' },
  connected: { label: 'Conectada', tone: 'success' },
  needs_attention: { label: 'Requiere atención', tone: 'warning' },
  disconnected: { label: 'Desconectada', tone: 'danger' },
};

export const LISTING_STATUS: Record<ListingStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Borrador', tone: 'neutral' },
  pending_review: { label: 'Pendiente de revisión', tone: 'accent' },
  active: { label: 'Activo', tone: 'success' },
  reserved: { label: 'Reservado', tone: 'info' },
  sold: { label: 'Vendido', tone: 'neutral' },
  archived: { label: 'Archivado', tone: 'neutral' },
  needs_attention: { label: 'Requiere atención', tone: 'warning' },
};

export const CONVERSATION_STATUS: Record<ConversationStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pendiente', tone: 'warning' },
  negotiating: { label: 'Negociando', tone: 'accent' },
  closed: { label: 'Cerrada', tone: 'success' },
  archived: { label: 'Archivada', tone: 'neutral' },
};

export const SALE_STATUS: Record<SaleStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pendiente', tone: 'warning' },
  in_progress: { label: 'En proceso', tone: 'info' },
  completed: { label: 'Vendida', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
};

export const SALE_METHOD: Record<SaleMethod, string> = {
  shipping: 'Envío',
  in_person: 'En persona',
  other: 'Otro',
};

export const PRODUCT_CONDITION: Record<ProductCondition, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  very_good: 'Muy bueno',
  good: 'Bueno',
  acceptable: 'Aceptable',
  for_parts: 'Para piezas',
};

export const PRIORITY: Record<'low' | 'normal' | 'high', { label: string; tone: Tone }> = {
  low: { label: 'Baja', tone: 'neutral' },
  normal: { label: 'Normal', tone: 'info' },
  high: { label: 'Alta', tone: 'danger' },
};
