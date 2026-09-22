import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAIService } from '@/lib/ai/service';
import { requireSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { errorResponse, tooManyRequests } from '@/lib/http/responses';
import { rateLimit } from '@/lib/http/rate-limit';

/**
 * Genera un BORRADOR de respuesta para una conversación, y si el comprador ha
 * hecho una oferta, también el análisis de negociación.
 *
 * Nada de lo que devuelve esta ruta se envía a Wallapop: no existe API de
 * mensajería. El usuario copia el texto y lo envía él mismo.
 */

const bodySchema = z.object({
  conversationId: z.string().min(1),
  lastMessage: z.string().min(1).max(4000),
  listingTitle: z.string().min(1).max(200),
  priceCents: z.number().int().min(0).max(100_000_000),
  targetPriceCents: z.number().int().min(0).nullable(),
  minPriceCents: z.number().int().min(0).nullable(),
  features: z.record(z.string(), z.string()).default({}),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    // La IA cuesta dinero: se limita por usuario antes de tocar al proveedor.
    const limit = rateLimit(`ai:reply:${session.userId}`, { limit: 20, windowMs: 60_000 });
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const input = bodySchema.parse(await request.json());

    // Comprobación de pertenencia: la conversación debe ser de este usuario.
    const repo = await getRepository();
    const conversation = await repo.getConversation(session.userId, input.conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada.' }, { status: 404 });
    }

    const ai = getAIService();

    const [replyResult, analysisResult] = await Promise.all([
      ai.generateReply({
        listingTitle: input.listingTitle,
        priceCents: input.priceCents,
        minPriceCents: input.minPriceCents,
        lastMessage: input.lastMessage,
        features: input.features,
      }),
      ai.analyzeConversation({
        listingTitle: input.listingTitle,
        priceCents: input.priceCents,
        lastMessage: input.lastMessage,
        history: conversation.messages.map((m) => `${m.role}: ${m.body}`),
      }),
    ]);

    // Sólo se asesora la negociación si hay oferta y precios configurados.
    const offerCents = analysisResult.data.detectedOfferCents;
    const canNegotiate =
      offerCents !== null && input.minPriceCents !== null && input.targetPriceCents !== null;

    const negotiation = canNegotiate
      ? (
          await ai.negotiate({
            listingTitle: input.listingTitle,
            listedPriceCents: input.priceCents,
            targetPriceCents: input.targetPriceCents!,
            minPriceCents: input.minPriceCents!,
            offerCents,
          })
        ).data
      : null;

    await repo.logActivity(session.userId, {
      accountId: conversation.accountId,
      kind: 'ai_generation',
      message: `La IA ha preparado una respuesta para ${conversation.buyerAlias}`,
    });

    return NextResponse.json({
      reply: replyResult.data,
      analysis: analysisResult.data,
      negotiation,
      usage: replyResult.usage,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
