import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/config/env';

/**
 * Cliente Supabase ligado a la sesión del usuario. Respeta RLS.
 * Es el que debe usarse prácticamente siempre.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const env = getEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Los Server Components no pueden escribir cookies. El middleware
          // refresca la sesión, así que ignorarlo aquí es correcto.
        }
      },
    },
  });
}

/**
 * Cliente con clave de servicio: **ignora RLS**.
 *
 * Uso permitido únicamente donde no hay sesión de usuario:
 *   - el receptor de webhooks de Wallapop,
 *   - tareas de mantenimiento del servidor.
 *
 * Cualquier consulta hecha con este cliente DEBE filtrar por `user_id` a mano.
 */
export async function createSupabaseAdminClient(): Promise<SupabaseClient> {
  const env = getEnv();

  // Importación diferida: mantiene el SDK fuera de los bundles que no lo usan.
  const { createClient } = await import('@supabase/supabase-js');

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
