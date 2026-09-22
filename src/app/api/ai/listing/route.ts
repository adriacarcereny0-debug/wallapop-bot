import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAIService } from '@/lib/ai/service';
import { productInputSchema } from '@/lib/ai/types';
import { requireSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { errorResponse, tooManyRequests } from '@/lib/http/responses';
import { rateLimit } from '@/lib/http/rate-limit';

/**
 * Genera el contenido de un anuncio a partir de los datos de un producto.
 *
 * El resultado NO se publica: queda como propuesta a la espera de que el usuario
 * lo edite y lo apruebe en la pantalla de revisión.
 */

const bodySchema = z.object({
  product: productInputSchema,
  /** Si se indica, se reescribe un anuncio existente en lugar de crearlo. */
  current: z
    .object({ title: z.string().max(200), description: z.string().max(5000) })
    .nullable()
    .default(null),
  accountId: z.string().nullable().default(null),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    const limit = rateLimit(`ai:listing:${session.userId}`, { limit: 15, windowMs: 60_000 });
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const input = bodySchema.parse(await request.json());

    // Si se indica cuenta, debe pertenecer al usuario.
    const repo = await getRepository();
    if (input.accountId) {
      const account = await repo.getAccount(session.userId, input.accountId);
      if (!account) {
        return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 });
      }
    }

    const ai = getAIService();
    const result = input.current
      ? await ai.improveListing(input.product, input.current)
      : await ai.generateListing(input.product);

    await repo.logActivity(session.userId, {
      accountId: input.accountId,
      kind: 'ai_generation',
      message: `La IA ha generado contenido para «${input.product.name}»`,
    });

    return NextResponse.json({ listing: result.data, usage: result.usage });
  } catch (error) {
    return errorResponse(error);
  }
}
