'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import type { FormState } from '@/lib/forms/state';

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Ponle un nombre a la cuenta.')
  .max(60, 'El nombre es demasiado largo.');

/**
 * Crea una cuenta de Wallapop en la aplicación.
 *
 * Crear la cuenta aquí NO crea ninguna cuenta en Wallapop: sólo prepara el
 * hueco donde guardar su autorización. La cuenta de Wallapop tiene que existir
 * ya y crearla a mano el vendedor.
 */
export async function createAccount(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const parsed = nameSchema.safeParse(formData.get('name'));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nombre no válido.', success: null };
  }

  const repo = await getRepository();
  try {
    const account = await repo.createAccount(session.userId, { name: parsed.data });
    await repo.logActivity(session.userId, {
      accountId: account.id,
      kind: 'account_attention',
      message: `Cuenta «${account.name}» añadida, pendiente de conectar`,
    });
  } catch (cause) {
    return { error: (cause as Error).message, success: null };
  }

  revalidatePath('/cuentas');
  return { error: null, success: 'Cuenta añadida. Ya puedes conectarla con Wallapop.' };
}

export async function disconnectAccount(formData: FormData): Promise<void> {
  const session = await requireSession();
  const accountId = String(formData.get('accountId') ?? '');
  if (!accountId) return;

  const repo = await getRepository();
  // getAccount filtra por userId: una cuenta ajena devuelve null y no se toca.
  const account = await repo.getAccount(session.userId, accountId);
  if (!account) return;

  await repo.disconnectAccount(session.userId, accountId);
  await repo.logActivity(session.userId, {
    accountId,
    kind: 'account_attention',
    message: `Cuenta «${account.name}» desconectada`,
  });

  revalidatePath('/cuentas');
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const session = await requireSession();
  const accountId = String(formData.get('accountId') ?? '');
  if (!accountId) return;

  const repo = await getRepository();
  const account = await repo.getAccount(session.userId, accountId);
  if (!account) return;

  // En cascada se llevará sus anuncios, conversaciones y ventas: lo avisa la interfaz.
  await repo.deleteAccount(session.userId, accountId);
  revalidatePath('/cuentas');
}
