import { beforeEach, describe, expect, it } from 'vitest';
import { getEnv, normalizeEnv, resetEnvCache } from './env';

describe('normalizeEnv', () => {
  it('convierte la cadena vacía en "no configurado"', () => {
    expect(normalizeEnv({ DATA_MODE: '' }).DATA_MODE).toBeUndefined();
  });

  it('trata como vacío una cadena de sólo espacios', () => {
    expect(normalizeEnv({ DATA_MODE: '   ' }).DATA_MODE).toBeUndefined();
  });

  it('respeta los valores reales', () => {
    expect(normalizeEnv({ DATA_MODE: 'supabase' }).DATA_MODE).toBe('supabase');
  });
});

describe('getEnv', () => {
  beforeEach(() => {
    resetEnvCache();
    // Limpiar cualquier valor heredado del entorno de test.
    for (const key of [
      'DATA_MODE',
      'AI_PROVIDER',
      'IMAGE_PROVIDER',
      'WALLAPOP_INTEGRATION_ENABLED',
      'NEXT_PUBLIC_APP_URL',
      'AI_DAILY_BUDGET_CENTS',
    ]) {
      delete process.env[key];
    }
  });

  it('arranca sin ninguna variable definida', () => {
    const env = getEnv();

    expect(env.DATA_MODE).toBe('demo');
    expect(env.AI_PROVIDER).toBe('demo');
    expect(env.WALLAPOP_INTEGRATION_ENABLED).toBe(false);
  });

  it('arranca con todas las variables creadas pero VACÍAS', () => {
    // Éste es el caso real que rompía el despliegue en Vercel: el panel guarda
    // una variable sin valor como cadena vacía, no como ausente.
    process.env.DATA_MODE = '';
    process.env.AI_PROVIDER = '';
    process.env.IMAGE_PROVIDER = '';
    process.env.WALLAPOP_INTEGRATION_ENABLED = '';
    process.env.NEXT_PUBLIC_APP_URL = '';
    process.env.AI_DAILY_BUDGET_CENTS = '';

    const env = getEnv();

    expect(env.DATA_MODE).toBe('demo');
    expect(env.AI_PROVIDER).toBe('demo');
    expect(env.IMAGE_PROVIDER).toBe('demo');
    expect(env.WALLAPOP_INTEGRATION_ENABLED).toBe(false);
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
    expect(env.AI_DAILY_BUDGET_CENTS).toBe(500);
  });

  it('sigue rechazando un valor presente pero inválido', () => {
    // La validación no se ha aflojado: un valor equivocado sigue fallando.
    process.env.DATA_MODE = 'mongodb';
    expect(() => getEnv()).toThrow(/DATA_MODE/);
  });

  it('exige las claves de Supabase cuando DATA_MODE=supabase', () => {
    process.env.DATA_MODE = 'supabase';
    expect(() => getEnv()).toThrow(/SUPABASE/);
  });
});
