'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { toFormError, type FormState } from '@/lib/forms/state';

const createSchema = z.object({
  accountId: z.string().min(1, 'Elige la cuenta.'),
  listingId: z.string().optional(),
  buyerAlias: z
    .string()
    .trim()
    .min(1, 'Pon un alias para el comprador.')
    .max(60, 'El alias es demasiado largo.'),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  firstMessage: z
    .string()
    .trim()
    .min(1, 'Copia aquí el mensaje del comprador.')
    .max(4000, 'El mensaje es demasiado largo.'),
});

/**
 * Registra una conversación recibida en Wallapop.
 *
 * Existe porque Wallapop **no publica API de mensajería**: el contenido del
 * chat no se puede leer por programa. El vendedor lo copia aquí para que la IA
 * pueda analizarlo y proponer una respuesta.
 *
 * Por el mismo motivo se pide un *alias*, no el nombre real: no hay razón para
 * guardar datos personales del comprador en esta base de datos.
 */
export async function createConversation(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos.', success: null };
  }

  const repo = await getRepository();

  const account = await repo.getAccount(session.userId, parsed.data.accountId);
  if (!account) return { error: 'Cuenta no encontrada.', success: null };

  // El anuncio es opcional, pero si se indica debe ser del usuario y de esa cuenta.
  let listingId: string | null = null;
  if (parsed.data.listingId) {
    const listing = await repo.getListing(session.userId, parsed.data.listingId);
    if (!listing) return { error: 'Anuncio no encontrado.', success: null };
    if (listing.accountId !== parsed.data.accountId) {
      return { error: 'Ese anuncio no pertenece a la cuenta elegida.', success: null };
    }
    listingId = listing.id;
  }

  try {
    const conversation = await repo.createConversation(session.userId, {
      accountId: parsed.data.accountId,
      listingId,
      buyerAlias: parsed.data.buyerAlias,
      priority: parsed.data.priority,
      firstMessage: parsed.data.firstMessage,
    });

    await repo.logActivity(session.userId, {
      accountId: conversation.accountId,
      kind: 'conversation_pending',
      message: `Nueva conversación pendiente con ${conversation.buyerAlias}`,
    });
  } catch (cause) {
    return { error: toFormError(cause), success: null };
  }

  revalidatePath('/conversaciones');
  return { error: null, success: 'Conversación registrada.' };
}

/** Añade un mensaje nuevo del comprador a una conversación existente. */
export async function addBuyerMessage(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const conversationId = String(formData.get('conversationId') ?? '');
  const body = String(formData.get('body') ?? '').trim();

  if (!conversationId) return { error: 'Falta la conversación.', success: null };
  if (!body) return { error: 'Escribe el mensaje del comprador.', success: null };

  const repo = await getRepository();
  try {
    await repo.appendMessage(session.userId, conversationId, { role: 'buyer', body });
  } catch (cause) {
    return { error: toFormError(cause), success: null };
  }

  revalidatePath('/conversaciones');
  return { error: null, success: 'Mensaje añadido.' };
}

/** Guarda la respuesta que el vendedor ha enviado de verdad desde Wallapop. */
export async function recordSellerReply(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const conversationId = String(formData.get('conversationId') ?? '');
  const body = String(formData.get('body') ?? '').trim();

  if (!conversationId || !body) {
    return { error: 'Falta el texto de la respuesta.', success: null };
  }

  const repo = await getRepository();
  try {
    await repo.appendMessage(session.userId, conversationId, { role: 'seller', body });
    await repo.updateConversation(session.userId, conversationId, { status: 'negotiating' });
  } catch (cause) {
    return { error: toFormError(cause), success: null };
  }

  revalidatePath('/conversaciones');
  return { error: null, success: 'Respuesta registrada en el historial.' };
}

export async function closeConversation(formData: FormData): Promise<void> {
  const session = await requireSession();
  const conversationId = String(formData.get('conversationId') ?? '');
  if (!conversationId) return;

  const repo = await getRepository();
  const conversation = await repo.getConversation(session.userId, conversationId);
  if (!conversation) return;

  await repo.updateConversation(session.userId, conversationId, { status: 'closed' });
  revalidatePath('/conversaciones');
}
