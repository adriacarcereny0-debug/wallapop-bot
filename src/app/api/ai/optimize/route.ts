import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAIService } from '@/lib/ai/service';
import { requireSession } from '@/lib/auth/session';
import { errorResponse, tooManyRequests } from '@/lib/http/responses';
import { rateLimit } from '@/lib/http/rate-limit';

/**
 * Analiza la CALIDAD de un anuncio y devuelve recomendaciones.
 *
 * La puntuación mide claridad y completitud. NO predice visitas ni ventas, y la
 * interfaz debe presentarla siempre en esos términos.
 */

const bodySchema = z.object({
  title: z.string().max(200),
  description: z.string().max(5000),
  priceCents: z.number().int().min(0).max(100_000_000),
  photoCount: z.number().int().min(0).max(50),
  category: z.string().max(100),
  features: z.record(z.string(), z.string()).default({}),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    const limit = rateLimit(`ai:optimize:${session.userId}`, { limit: 20, windowMs: 60_000 });
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const input = bodySchema.parse(await request.json());
    const result = await getAIService().optimizeListing(input);

    return NextResponse.json({ optimization: result.data, usage: result.usage });
  } catch (error) {
    return errorResponse(error);
  }
}
