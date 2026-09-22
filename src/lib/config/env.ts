import { z } from 'zod';

/**
 * Validación centralizada del entorno.
 *
 * Reglas duras:
 *  - Ninguna clave secreta lleva prefijo `NEXT_PUBLIC_`.
 *  - El objeto `env` sólo se importa desde código de servidor.
 *  - Si falta algo necesario para el modo activo, la app falla al arrancar,
 *    no a mitad de una petición.
 */

const booleanish = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const serverSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

    DATA_MODE: z.enum(['demo', 'supabase']).default('demo'),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal('')),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal('')),

    AI_PROVIDER: z.enum(['demo', 'anthropic']).default('demo'),
    ANTHROPIC_API_KEY: z.string().optional().or(z.literal('')),
    ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),
    AI_DAILY_BUDGET_CENTS: z.coerce.number().int().min(0).default(500),

    IMAGE_PROVIDER: z.enum(['demo', 'openai', 'gemini']).default('demo'),
    OPENAI_API_KEY: z.string().optional().or(z.literal('')),
    GEMINI_API_KEY: z.string().optional().or(z.literal('')),

    WALLAPOP_INTEGRATION_ENABLED: booleanish,
    WALLAPOP_CLIENT_ID: z.string().optional().or(z.literal('')),
    WALLAPOP_CLIENT_SECRET: z.string().optional().or(z.literal('')),
    WALLAPOP_REDIRECT_URI: z.string().optional().or(z.literal('')),

    TOKEN_ENCRYPTION_KEY: z.string().optional().or(z.literal('')),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.DATA_MODE === 'supabase') {
      for (const key of [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
      ] as const) {
        if (!cfg[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} es obligatoria cuando DATA_MODE=supabase`,
          });
        }
      }
    }

    if (cfg.AI_PROVIDER === 'anthropic' && !cfg.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANTHROPIC_API_KEY'],
        message: 'ANTHROPIC_API_KEY es obligatoria cuando AI_PROVIDER=anthropic',
      });
    }

    if (cfg.WALLAPOP_INTEGRATION_ENABLED) {
      for (const key of [
        'WALLAPOP_CLIENT_ID',
        'WALLAPOP_CLIENT_SECRET',
        'WALLAPOP_REDIRECT_URI',
        'TOKEN_ENCRYPTION_KEY',
      ] as const) {
        if (!cfg[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} es obligatoria cuando WALLAPOP_INTEGRATION_ENABLED=true`,
          });
        }
      }
    }
  });

export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Normaliza el entorno antes de validarlo.
 *
 * Motivo: los paneles de alojamiento (Vercel entre ellos) guardan una variable
 * "sin valor" como **cadena vacía**, no como ausente. Zod sólo aplica
 * `.default()` cuando el valor es `undefined`, así que una variable creada pero
 * vacía hacía fallar el arranque en lugar de caer al valor por defecto.
 *
 * Para este esquema, vacío y ausente significan lo mismo: no configurado.
 */
export function normalizeEnv(
  source: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(source)) {
    normalized[key] = value?.trim() === '' ? undefined : value;
  }

  return normalized;
}

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(normalizeEnv(process.env));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  · ${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuración de entorno inválida:\n${detail}`);
  }

  cached = parsed.data;
  return cached;
}

/** Sólo para tests: descarta la caché del entorno. */
export function resetEnvCache(): void {
  cached = null;
}
