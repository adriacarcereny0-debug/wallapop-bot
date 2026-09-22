import { z } from 'zod';

/**
 * Validación centralizada del entorno.
 *
 * Esta aplicación es de producción: NO tiene modo demo. Sin base de datos y sin
 * proveedor de IA no arranca, y falla al arrancar en lugar de a mitad de la
 * petición de un usuario.
 *
 * Reglas duras:
 *  - Ninguna clave secreta lleva prefijo `NEXT_PUBLIC_`.
 *  - Este módulo sólo se importa desde código de servidor.
 */

/**
 * Normaliza el entorno antes de validarlo.
 *
 * Los paneles de alojamiento (Vercel entre ellos) guardan una variable creada
 * pero sin valor como **cadena vacía**, no como ausente. Zod sólo aplica
 * `.default()` cuando el valor es `undefined`, así que sin esto una variable
 * vacía haría fallar el arranque en lugar de caer al valor por defecto.
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

const required = (name: string) =>
  z.string({ error: `${name} es obligatoria` }).min(1, `${name} es obligatoria`);

const serverSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

    // ── Base de datos (obligatoria) ─────────────────────────────────────────
    NEXT_PUBLIC_SUPABASE_URL: required('NEXT_PUBLIC_SUPABASE_URL').url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
    /** Bucket de Supabase Storage donde viven las fotos de producto. */
    SUPABASE_STORAGE_BUCKET: z.string().default('product-images'),

    // ── IA (obligatoria) ────────────────────────────────────────────────────
    ANTHROPIC_API_KEY: required('ANTHROPIC_API_KEY'),
    /** Modelo principal: redacta el texto que se publica. La calidad importa. */
    ANTHROPIC_MODEL: z.string().default('claude-opus-5'),
    /**
     * Modelo económico para trabajo de usar y tirar (borradores de respuesta,
     * análisis de conversación). Permite recortar coste sin tocar la calidad
     * del texto que acaba publicado.
     */
    ANTHROPIC_MODEL_FAST: z.string().default('claude-haiku-4-5'),
    /** Tope de gasto por usuario y día, en céntimos de dólar. 0 = sin tope. */
    AI_DAILY_BUDGET_CENTS: z.coerce.number().int().min(0).default(500),

    // ── Imágenes (opcional: sin clave, se suben fotos pero no se mejoran) ───
    IMAGE_PROVIDER: z.enum(['none', 'gemini', 'openai']).default('none'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_IMAGE_MODEL: z.string().default('gemini-2.5-flash-image'),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_IMAGE_MODEL: z.string().default('gpt-image-1'),

    // ── Wallapop Connect (opcional hasta que Wallapop autorice) ─────────────
    WALLAPOP_CLIENT_ID: z.string().optional(),
    WALLAPOP_CLIENT_SECRET: z.string().optional(),
    WALLAPOP_REDIRECT_URI: z.string().optional(),

    /** Cifra los tokens OAuth guardados en base de datos (AES-256-GCM). */
    TOKEN_ENCRYPTION_KEY: required('TOKEN_ENCRYPTION_KEY').min(
      16,
      'TOKEN_ENCRYPTION_KEY debe tener al menos 16 caracteres. Genera una con: openssl rand -base64 32',
    ),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.IMAGE_PROVIDER === 'gemini' && !cfg.GEMINI_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['GEMINI_API_KEY'],
        message: 'GEMINI_API_KEY es obligatoria cuando IMAGE_PROVIDER=gemini',
      });
    }
    if (cfg.IMAGE_PROVIDER === 'openai' && !cfg.OPENAI_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['OPENAI_API_KEY'],
        message: 'OPENAI_API_KEY es obligatoria cuando IMAGE_PROVIDER=openai',
      });
    }

    // Las credenciales de Wallapop van juntas o no van: media integración es
    // peor que ninguna, porque falla a mitad del flujo de conexión.
    const wallapopParts = [
      cfg.WALLAPOP_CLIENT_ID,
      cfg.WALLAPOP_CLIENT_SECRET,
      cfg.WALLAPOP_REDIRECT_URI,
    ];
    const provided = wallapopParts.filter(Boolean).length;

    if (provided > 0 && provided < 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['WALLAPOP_CLIENT_ID'],
        message:
          'Las credenciales de Wallapop van juntas: WALLAPOP_CLIENT_ID, ' +
          'WALLAPOP_CLIENT_SECRET y WALLAPOP_REDIRECT_URI. Deja las tres vacías ' +
          'mientras no tengas el alta de aplicación integradora.',
      });
    }
  });

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(normalizeEnv(process.env));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  · ${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Configuración de entorno inválida:\n${detail}\n\n` +
        'Revisa docs/ENVIRONMENT.md y las variables del proyecto.',
    );
  }

  cached = parsed.data;
  return cached;
}

/**
 * `true` cuando hay credenciales de aplicación integradora de Wallapop.
 *
 * Es lo único que decide si se puede conectar una cuenta y publicar. No hay
 * interruptor manual: o están las credenciales o no están.
 */
export function isWallapopConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    env.WALLAPOP_CLIENT_ID && env.WALLAPOP_CLIENT_SECRET && env.WALLAPOP_REDIRECT_URI,
  );
}

/** `true` si hay proveedor de mejora de imágenes configurado. */
export function isImageEnhancementConfigured(): boolean {
  return getEnv().IMAGE_PROVIDER !== 'none';
}

/** Sólo para tests: descarta la caché del entorno. */
export function resetEnvCache(): void {
  cached = null;
}
