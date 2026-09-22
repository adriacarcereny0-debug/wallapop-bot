'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { FormState } from '@/lib/forms/state';

const schema = z.object({
  email: z.email('Introduce un correo electrónico válido.'),
  password: z.string().min(1, 'Introduce tu contraseña.'),
});

/**
 * Inicia sesión contra Supabase Auth.
 *
 * El mensaje de error es deliberadamente genérico: distinguir entre «ese correo
 * no existe» y «la contraseña es incorrecta» permitiría averiguar qué cuentas
 * están dadas de alta.
 */
export async function login(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos.', success: null };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: 'Correo o contraseña incorrectos.', success: null };
  }

  redirect('/panel');
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/entrar');
}
