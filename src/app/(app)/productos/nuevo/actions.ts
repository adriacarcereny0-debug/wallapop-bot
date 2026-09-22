'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { newProductSchema, parseFeatures } from '@/lib/validation/product';

export interface FormState {
  error: string | null;
  fieldErrors: Record<string, string>;
}

/**
 * Crea un producto en el catálogo.
 *
 * La validación ocurre aquí, en el servidor. Los errores vuelven al formulario
 * con el campo concreto, para que el usuario sepa qué corregir.
 */
export async function createProduct(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const parsed = newProductSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { error: 'Revisa los campos marcados.', fieldErrors };
  }

  const input = parsed.data;
  const repo = await getRepository();

  try {
    await repo.createProduct(session.userId, {
      name: input.name,
      brand: input.brand,
      model: input.model,
      category: input.category,
      subcategory: input.subcategory,
      condition: input.condition,
      purchasePriceCents: input.purchasePrice,
      targetPriceCents: input.targetPrice,
      minPriceCents: input.minPrice,
      internalDescription: input.internalDescription,
      publicDescription: input.publicDescription,
      features: parseFeatures(input.features),
      sku: input.sku,
      stock: input.stock,
      internalNotes: input.internalNotes,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Error desconocido';

    // El SKU es único por usuario: es el choque más probable.
    if (message.includes('sku') || message.includes('unique')) {
      return {
        error: 'Ya tienes un producto con ese SKU.',
        fieldErrors: { sku: 'Este SKU ya está en uso.' },
      };
    }
    return { error: `No se pudo crear el producto: ${message}`, fieldErrors: {} };
  }

  revalidatePath('/productos');
  redirect('/productos');
}
