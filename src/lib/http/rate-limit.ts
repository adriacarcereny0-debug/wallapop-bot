/**
 * Limitador de peticiones en memoria, por usuario y por ruta.
 *
 * Limitación conocida: en serverless cada instancia tiene su propio contador,
 * así que el límite efectivo se multiplica por el número de instancias activas.
 * Es suficiente para frenar bucles accidentales y abusos triviales, que es lo
 * que protege el gasto de IA. Para un límite estricto hace falta un almacén
 * compartido (Upstash Redis o similar): ver docs/DEPLOYMENT.md.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Limpieza perezosa: evita que el mapa crezca sin fin. */
function sweep(now: number): void {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true, remaining: options.limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= options.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { ok: true, remaining: options.limit - bucket.count, retryAfterSeconds: 0 };
}

/** Sólo para tests. */
export function resetRateLimits(): void {
  buckets.clear();
}
