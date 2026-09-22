import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface Session {
  userId: string;
  email: string;
  displayName: string;
}

/**
 * Devuelve la sesión activa, o `null` si no la hay.
 *
 * Usa `getUser()`, que valida el token contra el servidor de Supabase. NO se usa
 * `getSession()`, que sólo lee la cookie y por tanto es falsificable.
 *
 * `cache()` deduplica la llamada dentro de una misma petición: el armazón, la
 * página y sus componentes piden la sesión sin provocar tres viajes de red.
 */
export const getSession = cache(async function getSession(): Promise<Session | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const metadata = data.user.user_metadata as { display_name?: string } | null;

  return {
    userId: data.user.id,
    email: data.user.email ?? '',
    displayName: metadata?.display_name ?? data.user.email?.split('@')[0] ?? 'Usuario',
  };
});

/** Igual que `getSession`, pero lanza si no hay sesión. Para rutas de API. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('No autorizado');
    this.name = 'UnauthorizedError';
  }
}
