import { getEnv } from '@/lib/config/env';
import { DEMO_USER_ID } from '@/lib/data/demo-seed';

export interface Session {
  userId: string;
  email: string;
  displayName: string;
  /** `true` cuando la sesión es la del modo demo y no hay autenticación real. */
  isDemo: boolean;
}

/**
 * Devuelve la sesión activa, o `null` si no la hay.
 *
 * En `DATA_MODE=demo` se devuelve siempre una sesión ficticia: la aplicación es
 * navegable sin montar Supabase. En `DATA_MODE=supabase` se exige una sesión
 * real y verificada contra el servidor de autenticación.
 */
export async function getSession(): Promise<Session | null> {
  const env = getEnv();

  if (env.DATA_MODE === 'demo') {
    return {
      userId: DEMO_USER_ID,
      email: 'demo@wallapop-assistant.local',
      displayName: 'Usuario demo',
      isDemo: true,
    };
  }

  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();

  // `getUser()` valida el token contra Supabase. No se usa `getSession()`,
  // que sólo lee la cookie y es falsificable.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return {
    userId: data.user.id,
    email: data.user.email ?? '',
    displayName:
      (data.user.user_metadata?.display_name as string | undefined) ??
      data.user.email?.split('@')[0] ??
      'Usuario',
    isDemo: false,
  };
}

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
