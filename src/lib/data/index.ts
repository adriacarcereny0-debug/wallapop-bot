import { SupabaseRepository } from './supabase-repository';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Repository } from './repository';

/**
 * Devuelve el repositorio ligado a la sesión del usuario.
 *
 * No hay variante en memoria: esta aplicación siempre habla con PostgreSQL.
 */
export async function getRepository(): Promise<Repository> {
  return new SupabaseRepository(await createSupabaseServerClient());
}

export { DataError } from './supabase-repository';
export type { Repository } from './repository';
