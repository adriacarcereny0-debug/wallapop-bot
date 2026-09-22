import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Notice, Surface, buttonClass } from '@/components/ui/primitives';
import { getSession } from '@/lib/auth/session';
import { getEnv } from '@/lib/config/env';

export const metadata = { title: 'Entrar' };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/panel');

  const env = getEnv();

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-md bg-accent text-xs font-bold text-on-accent"
          >
            WA
          </span>
          <span className="font-semibold tracking-tight">Wallapop Assistant</span>
        </div>

        <h1 className="text-xl font-semibold tracking-tight">Entrar en el panel</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Herramienta privada de gestión. El acceso está restringido a las cuentas autorizadas.
        </p>

        <Surface className="mt-6 p-5">
          {env.DATA_MODE === 'demo' ? (
            <>
              <Notice tone="info" title="Modo demostración">
                La aplicación funciona con datos ficticios y no requiere autenticación. Configura
                Supabase y pon <code className="font-mono">DATA_MODE=supabase</code> para activar
                el acceso real.
              </Notice>
              <Link href="/panel" className={buttonClass('primary', 'mt-4 w-full')}>
                Entrar en la demostración
              </Link>
            </>
          ) : (
            <>
              <form action="/api/auth/login" method="post" className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">Correo electrónico</span>
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">Contraseña</span>
                  <input
                    type="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm"
                  />
                </label>
                <button type="submit" className={buttonClass('primary', 'mt-1 w-full')}>
                  Entrar
                </button>
              </form>
              <p className="mt-4 text-2xs leading-relaxed text-faint">
                Las credenciales se validan contra Supabase Auth. Esta aplicación nunca te pedirá
                tu contraseña de Wallapop: las cuentas se conectan por OAuth.
              </p>
            </>
          )}
        </Surface>
      </div>
    </main>
  );
}
