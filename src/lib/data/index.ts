import { getEnv } from '@/lib/config/env';
import { DemoRepository } from './demo-repository';
import type { Repository } from './repository';

/**
 * El repositorio demo se mantiene entre peticiones dentro del mismo proceso,
 * de modo que lo que el usuario crea durante la sesión persiste mientras la
 * instancia siga viva.
 */
const globalForRepo = globalThis as unknown as { __demoRepo?: DemoRepository };

/** Devuelve la implementación de repositorio que corresponde al entorno. */
export async function getRepository(): Promise<Repository> {
  const env = getEnv();

  if (env.DATA_MODE === 'demo') {
    globalForRepo.__demoRepo ??= new DemoRepository();
    return globalForRepo.__demoRepo;
  }

  const [{ SupabaseRepository }, { createSupabaseServerClient }] = await Promise.all([
    import('./supabase-repository'),
    import('@/lib/supabase/server'),
  ]);
  return new SupabaseRepository(await createSupabaseServerClient());
}

export type { Repository } from './repository';
