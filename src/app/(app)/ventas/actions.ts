'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { parseEurosToCents } from '@/lib/format';
import { toFormError, type FormState } from '@/lib/forms/state';

const schema = z.object({
  accountId: z.string().min(1, 'Elige la cuenta.'),
  productId: z.string().min(1, 'Elige el producto.'),
  listingId: z.string().optional(),
  buyerAlias: z.string().trim().max(60).optional(),
  price: z.string().trim().min(1, 'Indica el importe.'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('completed'),
  method: z.enum(['shipping', 'in_person', 'other']).default('shipping'),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * Registra una venta.
 *
 * Wallapop no expone las ventas por API salvo las que pasan por su sistema de
 * envíos, así que el registro es del vendedor: es su contabilidad, no una copia
 * de la de Wallapop. La interfaz lo deja claro para no confundir las cifras.
 */
export async function createSale(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos.', success: null };
  }

  const priceCents = parseEurosToCents(parsed.data.price);
  if (priceCents === null) {
    return { error: 'El importe no es válido. Ejemplo: 650 o 650,50.', success: null };
  }

  const repo = await getRepository();

  const [account, product] = await Promise.all([
    repo.getAccount(session.userId, parsed.data.accountId),
    repo.getProduct(session.userId, parsed.data.productId),
  ]);
  if (!account) return { error: 'Cuenta no encontrada.', success: null };
  if (!product) return { error: 'Producto no encontrado.', success: null };

  let listingId: string | null = null;
  if (parsed.data.listingId) {
    const listing = await repo.getListing(session.userId, parsed.data.listingId);
    if (!listing) return { error: 'Anuncio no encontrado.', success: null };
    listingId = listing.id;
  }

  try {
    await repo.createSale(session.userId, {
      accountId: parsed.data.accountId,
      productId: parsed.data.productId,
      listingId,
      buyerAlias: parsed.data.buyerAlias || null,
      priceCents,
      status: parsed.data.status,
      method: parsed.data.method,
      notes: parsed.data.notes || null,
    });

    await repo.logActivity(session.userId, {
      accountId: parsed.data.accountId,
      kind: 'sale_recorded',
      message: `Venta registrada: «${product.name}»`,
    });
  } catch (cause) {
    return { error: toFormError(cause), success: null };
  }

  revalidatePath('/ventas');
  revalidatePath('/panel');
  return { error: null, success: 'Venta registrada.' };
}
