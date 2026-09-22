import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refresca la sesión de Supabase y protege las rutas privadas.
 *
 * Se ejecuta antes que cualquier página. Dos cometidos:
 *  1. Renovar el token de sesión y reescribir las cookies (los Server
 *     Components no pueden hacerlo por sí mismos).
 *  2. Echar a `/entrar` a quien no tenga sesión.
 *
 * Lee las variables de `process.env` directamente, sin pasar por el esquema de
 * validación: el middleware corre en el runtime Edge, donde no está disponible
 * todo el entorno de Node.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin configuración no se puede autenticar a nadie: se deja pasar y la página
  // mostrará el error de configuración, que es más útil que un bucle de redirección.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith('/entrar');

  if (!user && !isAuthRoute) {
    const target = request.nextUrl.clone();
    target.pathname = '/entrar';
    target.search = '';
    return NextResponse.redirect(target);
  }

  if (user && isAuthRoute) {
    const target = request.nextUrl.clone();
    target.pathname = '/panel';
    target.search = '';
    return NextResponse.redirect(target);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todo menos los ficheros estáticos y el receptor de webhooks, que se
     * autentica por firma HMAC y no por sesión.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/wallapop/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
