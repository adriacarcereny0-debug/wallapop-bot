import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/config/env';

/**
 * Cliente Supabase ligado a la sesión del usuario (respeta RLS).
 * Es el que debe usarse en el 99 % de los casos.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const env = getEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Los Server Components no pueden escribir cookies; el middleware
          // refresca la sesión, así que ignorar aquí es correcto.
        }
      },
    },
  });
}

/**
 * Cliente con clave de servicio: **ignora RLS**.
 *
 * Uso permitido únicamente en:
 *   - el receptor de webhooks de Wallapop (no hay sesión de usuario),
 *   - tareas de mantenimiento del servidor.
 *
 * Nunca debe alcanzarse desde una ruta que sirva datos al navegador sin
 * filtrar explícitamente por `user_id`.
 */
export async function createSupabaseAdminClient(): Promise<SupabaseClient> {
  const env = getEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada');
  }

  // Importación diferida: mantiene el SDK fuera de cualquier bundle que no lo
  // necesite y evita mezclar CommonJS con ESM.
  const { createClient } = await import('@supabase/supabase-js');

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
