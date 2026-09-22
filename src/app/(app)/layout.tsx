import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { logout } from '@/app/(auth)/entrar/actions';
import { AccountFilter } from '@/components/shell/account-filter';
import { SidebarNav } from '@/components/shell/nav';
import { Pill } from '@/components/ui/primitives';
import { getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { isWallapopConfigured } from '@/lib/config/env';

/**
 * Nada de esta aplicación se prerenderiza.
 *
 * Todas las pantallas dependen de la sesión del usuario y de su base de datos,
 * así que generarlas en tiempo de construcción no tendría sentido: obligaría a
 * tener las credenciales de producción disponibles durante el `build`, que es
 * justo lo que no queremos.
 */
export const dynamic = 'force-dynamic';

/**
 * Armazón de la aplicación.
 *
 * La barra lateral y el selector de cuenta son persistentes: el usuario debe
 * saber en todo momento en qué cuenta está trabajando.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/entrar');

  const repo = await getRepository();
  const accounts = await repo.listAccounts(session.userId);

  const pendingMessages = accounts.reduce((sum, a) => sum + a.stats.pendingMessages, 0);
  const needsAttention = accounts.filter(
    (a) => a.status === 'needs_attention' || a.status === 'disconnected',
  ).length;

  const wallapopReady = isWallapopConfigured();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* ── Barra lateral ────────────────────────────────────────────────── */}
      <aside
        className="shrink-0 border-b border-line bg-surface lg:h-dvh lg:w-60 lg:border-r lg:border-b-0"
        aria-label="Barra lateral"
      >
        <div className="flex h-full flex-col gap-3 p-3 lg:sticky lg:top-0 lg:gap-6 lg:p-4">
          <Link href="/panel" className="flex items-center gap-2.5 px-1">
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-md bg-accent text-2xs font-bold text-on-accent"
            >
              WA
            </span>
            <span className="text-sm font-semibold tracking-tight">Wallapop Assistant</span>
          </Link>

          <SidebarNav
            counts={{ '/conversaciones': pendingMessages, '/cuentas': needsAttention }}
          />

          <div className="mt-auto hidden lg:block">
            <div className="rounded-lg border border-line bg-surface-sunken p-3">
              <p className="text-2xs font-semibold text-muted">Conexión con Wallapop</p>
              <p className="mt-1.5">
                <Pill tone={wallapopReady ? 'success' : 'warning'}>
                  {wallapopReady ? 'Credenciales activas' : 'Pendiente de alta'}
                </Pill>
              </p>
              <p className="mt-2 text-2xs leading-relaxed text-faint">
                {wallapopReady
                  ? 'Ya puedes conectar cuentas y publicar.'
                  : 'Falta el alta de aplicación integradora de Wallapop.'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Contenido ────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-sm sm:px-6">
          <Suspense fallback={<div className="h-8 w-44" />}>
            <AccountFilter accounts={accounts} />
          </Suspense>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">{session.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                Salir
              </button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
