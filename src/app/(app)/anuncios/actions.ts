'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { toFormError, type FormState } from '@/lib/forms/state';
import { parseEurosToCents } from '@/lib/format';
import {
  markListingSold,
  publishListing,
  updatePublishedListing,
} from '@/lib/wallapop/publish';

// ── Crear anuncio desde un producto ─────────────────────────────────────────

const createSchema = z.object({
  accountId: z.string().min(1, 'Elige la cuenta de destino.'),
  productId: z.string().min(1, 'Elige el producto.'),
  title: z.string().trim().min(1, 'El título es obligatorio.').max(120),
  description: z.string().trim().max(4000).default(''),
  price: z.string().trim().min(1, 'El precio es obligatorio.'),
  categoryLeafId: z.string().trim().max(40).optional(),
});

export async function createListing(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos.', success: null };
  }

  const priceCents = parseEurosToCents(parsed.data.price);
  if (priceCents === null) {
    return { error: 'El precio no es válido. Ejemplo: 650 o 650,50.', success: null };
  }

  const repo = await getRepository();

  // Cuenta y producto deben ser del usuario: ambas lecturas filtran por userId.
  const [account, product] = await Promise.all([
    repo.getAccount(session.userId, parsed.data.accountId),
    repo.getProduct(session.userId, parsed.data.productId),
  ]);
  if (!account) return { error: 'Cuenta no encontrada.', success: null };
  if (!product) return { error: 'Producto no encontrado.', success: null };

  try {
    const listing = await repo.createListing(session.userId, {
      accountId: parsed.data.accountId,
      productId: parsed.data.productId,
      title: parsed.data.title,
      description: parsed.data.description,
      priceCents,
      status: 'draft',
      categoryLeafId: parsed.data.categoryLeafId || null,
      hashtags: [],
    });

    await repo.logActivity(session.userId, {
      accountId: listing.accountId,
      kind: 'listing_prepared',
      message: `Anuncio «${listing.title}» creado como borrador`,
    });
  } catch (cause) {
    return { error: toFormError(cause), success: null };
  }

  revalidatePath('/anuncios');
  return { error: null, success: 'Anuncio creado como borrador.' };
}

// ── Editar un anuncio ───────────────────────────────────────────────────────

const editSchema = z.object({
  listingId: z.string().min(1),
  title: z.string().trim().min(1, 'El título es obligatorio.').max(120),
  description: z.string().trim().max(4000),
  price: z.string().trim().min(1, 'El precio es obligatorio.'),
  categoryLeafId: z.string().trim().max(40).optional(),
});

export async function editListing(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos.', success: null };
  }

  const priceCents = parseEurosToCents(parsed.data.price);
  if (priceCents === null) {
    return { error: 'El precio no es válido. Ejemplo: 650 o 650,50.', success: null };
  }

  const repo = await getRepository();
  const listing = await repo.getListing(session.userId, parsed.data.listingId);
  if (!listing) return { error: 'Anuncio no encontrado.', success: null };

  try {
    await repo.updateListing(session.userId, parsed.data.listingId, {
      title: parsed.data.title,
      description: parsed.data.description,
      priceCents,
      categoryLeafId: parsed.data.categoryLeafId || null,
    });
  } catch (cause) {
    return { error: toFormError(cause), success: null };
  }

  revalidatePath(`/anuncios/${parsed.data.listingId}`);
  revalidatePath('/anuncios');

  return {
    error: null,
    success: listing.externalItemId
      ? 'Cambios guardados. Pulsa «Enviar cambios a Wallapop» para publicarlos.'
      : 'Cambios guardados.',
  };
}

// ── Operaciones contra Wallapop ─────────────────────────────────────────────

export async function publish(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const listingId = String(formData.get('listingId') ?? '');
  if (!listingId) return { error: 'Falta el anuncio.', success: null };

  const repo = await getRepository();
  try {
    await publishListing(repo, session.userId, listingId);
  } catch (cause) {
    return { error: toFormError(cause), success: null };
  }

  revalidatePath(`/anuncios/${listingId}`);
  revalidatePath('/anuncios');
  return { error: null, success: 'Anuncio publicado en Wallapop.' };
}

export async function pushUpdate(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const listingId = String(formData.get('listingId') ?? '');
  if (!listingId) return { error: 'Falta el anuncio.', success: null };

  const repo = await getRepository();
  try {
    await updatePublishedListing(repo, session.userId, listingId);
  } catch (cause) {
    return { error: toFormError(cause), success: null };
  }

  revalidatePath(`/anuncios/${listingId}`);
  return { error: null, success: 'Cambios enviados a Wallapop.' };
}

export async function markSold(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const listingId = String(formData.get('listingId') ?? '');
  if (!listingId) return { error: 'Falta el anuncio.', success: null };

  const repo = await getRepository();
  try {
    await markListingSold(repo, session.userId, listingId);
  } catch (cause) {
    return { error: toFormError(cause), success: null };
  }

  revalidatePath(`/anuncios/${listingId}`);
  revalidatePath('/anuncios');
  return { error: null, success: 'Anuncio marcado como vendido.' };
}

/** Aprueba el contenido generado por IA y deja el anuncio listo para publicar. */
export async function approveListing(formData: FormData): Promise<void> {
  const session = await requireSession();
  const listingId = String(formData.get('listingId') ?? '');
  if (!listingId) return;

  const repo = await getRepository();
  const listing = await repo.getListing(session.userId, listingId);
  if (!listing) return;

  await repo.updateListing(session.userId, listingId, { status: 'pending_review' });
  revalidatePath(`/anuncios/${listingId}`);
}
