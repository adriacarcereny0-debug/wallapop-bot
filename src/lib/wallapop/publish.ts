import type { Repository } from '@/lib/data/repository';
import type { Listing, Product } from '@/types/domain';
import { WallapopConnectClient, WallapopError } from './client';
import { getValidAccessToken } from './tokens';

/**
 * Publicación y actualización de anuncios en Wallapop.
 *
 * Todo lo que sale hacia Wallapop pasa por aquí. Se apoya en la Items Connect
 * API oficial: `POST /items` para publicar y `PUT /items/{id}` para modificar.
 */

export class PublishError extends Error {
  constructor(
    message: string,
    /** `true` si el usuario puede arreglarlo por su cuenta (datos, reconexión). */
    readonly actionable: boolean,
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

/** Comprueba que el anuncio tiene lo que Wallapop exige antes de gastar una llamada. */
function assertPublishable(listing: Listing, product: Product): void {
  const missing: string[] = [];

  if (!listing.title.trim()) missing.push('el título');
  if (!listing.description.trim()) missing.push('la descripción');
  if (listing.priceCents <= 0) missing.push('un precio mayor que cero');
  if (!listing.categoryLeafId) missing.push('la categoría de Wallapop');
  if (product.images.length === 0) missing.push('al menos una fotografía');

  if (missing.length > 0) {
    throw new PublishError(
      `Antes de publicar falta ${missing.join(', ')}. Complétalo y vuelve a intentarlo.`,
      true,
    );
  }
}

/** Traduce un anuncio propio al formato que espera la API de Wallapop. */
function toConnectItem(listing: Listing, product: Product) {
  return {
    category_leaf_id: listing.categoryLeafId!,
    title: listing.title,
    description: listing.description,
    price: { cash: listing.priceCents / 100, currency: 'EUR' },
    // `external_id` es el campo oficial para sincronizar con el SKU del vendedor.
    // Es lo que permite reconciliar catálogo propio y catálogo de Wallapop.
    attributes: { external_id: product.sku },
    hashtags: listing.hashtags,
  };
}

/**
 * Publica un anuncio en Wallapop y guarda el identificador devuelto.
 *
 * Si Wallapop responde con error, el anuncio se marca como «requiere atención»
 * con el motivo, en vez de quedarse en un estado ambiguo.
 */
export async function publishListing(
  repo: Repository,
  userId: string,
  listingId: string,
): Promise<{ externalItemId: string }> {
  const listing = await repo.getListing(userId, listingId);
  if (!listing) throw new PublishError('Anuncio no encontrado.', false);

  if (listing.externalItemId) {
    throw new PublishError(
      'Este anuncio ya está publicado en Wallapop. Usa «Actualizar» para modificarlo.',
      true,
    );
  }

  const product = await repo.getProduct(userId, listing.productId);
  if (!product) throw new PublishError('El producto del anuncio ya no existe.', false);

  assertPublishable(listing, product);

  const accessToken = await getValidAccessToken(repo, userId, listing.accountId);
  const client = new WallapopConnectClient(accessToken);

  const mainImage = product.images[0]!;

  try {
    const created = await client.createItem({
      item: toConnectItem(listing, product),
      main_image: { url: mainImage.url },
    });

    await repo.updateListing(userId, listingId, {
      externalItemId: created.id,
      status: 'active',
      publishedAt: new Date().toISOString(),
      attentionReason: null,
    });

    await repo.touchAccountSync(userId, listing.accountId);
    await repo.logActivity(userId, {
      accountId: listing.accountId,
      kind: 'listing_updated',
      message: `Anuncio «${listing.title}» publicado en Wallapop`,
    });

    return { externalItemId: created.id };
  } catch (cause) {
    const reason = describeWallapopError(cause);

    await repo.updateListing(userId, listingId, {
      status: 'needs_attention',
      attentionReason: reason,
    });

    throw new PublishError(reason, true);
  }
}

/** Envía a Wallapop los cambios de un anuncio ya publicado. */
export async function updatePublishedListing(
  repo: Repository,
  userId: string,
  listingId: string,
): Promise<void> {
  const listing = await repo.getListing(userId, listingId);
  if (!listing) throw new PublishError('Anuncio no encontrado.', false);

  if (!listing.externalItemId) {
    throw new PublishError('Este anuncio todavía no está publicado en Wallapop.', true);
  }

  const product = await repo.getProduct(userId, listing.productId);
  if (!product) throw new PublishError('El producto del anuncio ya no existe.', false);

  assertPublishable(listing, product);

  const accessToken = await getValidAccessToken(repo, userId, listing.accountId);
  const client = new WallapopConnectClient(accessToken);

  try {
    await client.updateItem(listing.externalItemId, { item: toConnectItem(listing, product) });

    await repo.updateListing(userId, listingId, { attentionReason: null, status: 'active' });
    await repo.logActivity(userId, {
      accountId: listing.accountId,
      kind: 'listing_updated',
      message: `Anuncio «${listing.title}» actualizado en Wallapop`,
    });
  } catch (cause) {
    const reason = describeWallapopError(cause);
    await repo.updateListing(userId, listingId, {
      status: 'needs_attention',
      attentionReason: reason,
    });
    throw new PublishError(reason, true);
  }
}

/** Marca el anuncio como vendido en Wallapop y registra el cambio. */
export async function markListingSold(
  repo: Repository,
  userId: string,
  listingId: string,
): Promise<void> {
  const listing = await repo.getListing(userId, listingId);
  if (!listing) throw new PublishError('Anuncio no encontrado.', false);

  // Sin publicar sólo cambia el estado local: no hay nada que decirle a Wallapop.
  if (!listing.externalItemId) {
    await repo.updateListing(userId, listingId, { status: 'sold' });
    return;
  }

  const accessToken = await getValidAccessToken(repo, userId, listing.accountId);
  const client = new WallapopConnectClient(accessToken);

  try {
    await client.markAsSold(listing.externalItemId);
    await repo.updateListing(userId, listingId, { status: 'sold', attentionReason: null });
  } catch (cause) {
    throw new PublishError(describeWallapopError(cause), true);
  }
}

/**
 * Traduce un error de Wallapop a algo que el vendedor pueda entender y actuar.
 *
 * Los códigos concretos vienen del comportamiento documentado de la API. Si
 * aparece uno nuevo, se muestra el estado y el detalle en crudo antes que un
 * «error desconocido» inútil.
 */
function describeWallapopError(cause: unknown): string {
  if (cause instanceof WallapopError) {
    switch (cause.status) {
      case 401:
        return 'Wallapop ha rechazado la autorización. Vuelve a conectar la cuenta.';
      case 403:
        return (
          'Wallapop no permite esta operación con la suscripción actual. ' +
          'Publicar y despublicar requiere Wallapop Pro.'
        );
      case 400:
        return `Wallapop ha rechazado los datos del anuncio: ${cause.detail ?? 'revisa categoría, precio y fotos.'}`;
      case 429:
        return 'Se ha superado el límite de peticiones de Wallapop. Espera un momento.';
      default:
        return `Wallapop devolvió un error ${cause.status}. Inténtalo de nuevo más tarde.`;
    }
  }

  return cause instanceof Error ? cause.message : 'Error desconocido al contactar con Wallapop.';
}
