import { beforeEach, describe, expect, it } from 'vitest';
import { getEnv, isWallapopConfigured, normalizeEnv, resetEnvCache } from './env';

/** Mínimo imprescindible para que la aplicación arranque. */
const REQUIRED = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://proyecto.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  TOKEN_ENCRYPTION_KEY: 'una-clave-de-cifrado-suficientemente-larga',
};

const MANAGED = [
  ...Object.keys(REQUIRED),
  'NEXT_PUBLIC_APP_URL',
  'IMAGE_PROVIDER',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_MODEL_FAST',
  'AI_DAILY_BUDGET_CENTS',
  'WALLAPOP_CLIENT_ID',
  'WALLAPOP_CLIENT_SECRET',
  'WALLAPOP_REDIRECT_URI',
];

function setEnv(values: Record<string, string>) {
  for (const key of MANAGED) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  resetEnvCache();
}

describe('normalizeEnv', () => {
  it('convierte la cadena vacía en "no configurado"', () => {
    expect(normalizeEnv({ IMAGE_PROVIDER: '' }).IMAGE_PROVIDER).toBeUndefined();
  });

  it('trata como vacío una cadena de sólo espacios', () => {
    expect(normalizeEnv({ IMAGE_PROVIDER: '   ' }).IMAGE_PROVIDER).toBeUndefined();
  });

  it('respeta los valores reales', () => {
    expect(normalizeEnv({ IMAGE_PROVIDER: 'gemini' }).IMAGE_PROVIDER).toBe('gemini');
  });
});

describe('getEnv', () => {
  beforeEach(() => setEnv(REQUIRED));

  it('arranca con lo mínimo imprescindible y aplica los valores por defecto', () => {
    const env = getEnv();

    expect(env.ANTHROPIC_MODEL).toBe('claude-opus-5');
    expect(env.ANTHROPIC_MODEL_FAST).toBe('claude-haiku-4-5');
    expect(env.IMAGE_PROVIDER).toBe('none');
    expect(env.SUPABASE_STORAGE_BUCKET).toBe('product-images');
  });

  it('tolera variables creadas pero vacías', () => {
    // El caso que rompía el despliegue: el panel guarda una variable sin valor
    // como cadena vacía, no como ausente.
    setEnv({ ...REQUIRED, IMAGE_PROVIDER: '', NEXT_PUBLIC_APP_URL: '', ANTHROPIC_MODEL: '' });

    const env = getEnv();
    expect(env.IMAGE_PROVIDER).toBe('none');
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
    expect(env.ANTHROPIC_MODEL).toBe('claude-opus-5');
  });

  it('no arranca sin base de datos', () => {
    setEnv({ ...REQUIRED, NEXT_PUBLIC_SUPABASE_URL: '' });
    expect(() => getEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('no arranca sin clave de IA', () => {
    setEnv({ ...REQUIRED, ANTHROPIC_API_KEY: '' });
    expect(() => getEnv()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('exige una clave de cifrado con longitud suficiente', () => {
    setEnv({ ...REQUIRED, TOKEN_ENCRYPTION_KEY: 'corta' });
    expect(() => getEnv()).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it('exige la clave del proveedor de imágenes si se activa', () => {
    setEnv({ ...REQUIRED, IMAGE_PROVIDER: 'gemini' });
    expect(() => getEnv()).toThrow(/GEMINI_API_KEY/);
  });

  it('rechaza credenciales de Wallapop a medias', () => {
    setEnv({ ...REQUIRED, WALLAPOP_CLIENT_ID: 'id-suelto' });
    expect(() => getEnv()).toThrow(/WALLAPOP_CLIENT/);
  });
});

describe('isWallapopConfigured', () => {
  beforeEach(() => setEnv(REQUIRED));

  it('es falso sin credenciales', () => {
    expect(isWallapopConfigured()).toBe(false);
  });

  it('es verdadero con las tres credenciales', () => {
    setEnv({
      ...REQUIRED,
      WALLAPOP_CLIENT_ID: 'id',
      WALLAPOP_CLIENT_SECRET: 'secret',
      WALLAPOP_REDIRECT_URI: 'https://app.example.com/api/wallapop/oauth/callback',
    });
    expect(isWallapopConfigured()).toBe(true);
  });
});
