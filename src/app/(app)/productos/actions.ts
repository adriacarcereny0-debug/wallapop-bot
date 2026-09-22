'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/session';
import { isImageEnhancementConfigured } from '@/lib/config/env';
import { getRepository } from '@/lib/data';
import { toFormError, type FormState } from '@/lib/forms/state';
import { enhanceImage } from '@/lib/images/service';
import { assertAcceptableImage, downloadImage, uploadImage } from '@/lib/images/storage';
import { ALLOWED_EDITS, isEditKind } from '@/lib/images/types';

/** Sube una fotografía original al almacenamiento y la asocia al producto. */
export async function uploadProductImage(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const productId = String(formData.get('productId') ?? '');
  const file = formData.get('file');

  if (!productId) return { error: 'Falta el producto.', success: null };
  if (!(file instanceof File)) return { error: 'Selecciona una imagen.', success: null };

  const repo = await getRepository();
  const product = await repo.getProduct(session.userId, productId);
  if (!product) return { error: 'Producto no encontrado.', success: null };

  try {
    assertAcceptableImage({ type: file.type, size: file.size });

    const url = await uploadImage(session.userId, productId, {
      data: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    });

    await repo.addProductImage(session.userId, {
      productId,
      url,
      kind: 'original',
      alt: `Fotografía de ${product.name}`,
      transformation: null,
      position: product.images.length,
    });
  } catch (cause) {
    return { error: toFormError(cause), success: null };
  }

  revalidatePath(`/productos/${productId}`);
  return { error: null, success: 'Fotografía añadida.' };
}

const enhanceSchema = z.object({
  productId: z.string().min(1),
  imageId: z.string().min(1),
  edit: z.string().refine(isEditKind, 'Esa edición no está permitida.'),
});

/**
 * Genera una versión mejorada de una foto.
 *
 * Sólo se aceptan las ediciones del catálogo cerrado de `ALLOWED_EDITS`, y la
 * original nunca se borra: la mejorada se añade aparte, marcada como tal, para
 * que siempre se pueda comparar con la foto real.
 */
export async function enhanceProductImage(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  if (!isImageEnhancementConfigured()) {
    return {
      error:
        'No hay proveedor de mejora de imágenes configurado. Define IMAGE_PROVIDER y su clave.',
      success: null,
    };
  }

  const parsed = enhanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos.', success: null };
  }

  const repo = await getRepository();
  const product = await repo.getProduct(session.userId, parsed.data.productId);
  if (!product) return { error: 'Producto no encontrado.', success: null };

  const source = product.images.find((image) => image.id === parsed.data.imageId);
  if (!source) return { error: 'Fotografía no encontrada.', success: null };

  const edit = ALLOWED_EDITS[parsed.data.edit];

  try {
    const original = await downloadImage(source.url);
    const improved = await enhanceImage(original, parsed.data.edit);

    const url = await uploadImage(session.userId, product.id, improved);

    await repo.addProductImage(session.userId, {
      productId: product.id,
      url,
      kind: 'enhanced',
      alt: `${source.alt} (${edit.label.toLowerCase()})`,
      transformation: edit.label,
      position: product.images.length,
    });

    await repo.logActivity(session.userId, {
      accountId: null,
      kind: 'image_enhanced',
      message: `Imagen mejorada para «${product.name}» (${edit.label.toLowerCase()})`,
    });
  } catch (cause) {
    return { error: toFormError(cause), success: null };
  }

  revalidatePath(`/productos/${product.id}`);
  return { error: null, success: `Versión con «${edit.label.toLowerCase()}» creada.` };
}

export async function deleteProductImage(formData: FormData): Promise<void> {
  const session = await requireSession();
  const imageId = String(formData.get('imageId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  if (!imageId || !productId) return;

  const repo = await getRepository();
  // deleteProductImage filtra por userId: una imagen ajena no se toca.
  await repo.deleteProductImage(session.userId, imageId);
  revalidatePath(`/productos/${productId}`);
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const session = await requireSession();
  const productId = String(formData.get('productId') ?? '');
  if (!productId) return;

  const repo = await getRepository();
  await repo.deleteProduct(session.userId, productId);
  revalidatePath('/productos');
}
