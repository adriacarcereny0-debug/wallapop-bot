import Link from 'next/link';
import {
  EmptyState,
  Notice,
  Pill,
  SectionHeader,
  Surface,
  buttonClass,
} from '@/components/ui/primitives';
import { getSession } from '@/lib/auth/session';
import { getEnv } from '@/lib/config/env';
import { getRepository } from '@/lib/data';
import { formatCurrency, formatNumber, formatRelative } from '@/lib/format';
import { ACCOUNT_STATUS } from '@/lib/labels';

export const metadata = { title: 'Cuentas' };

export default async function AccountsPage() {
  const session = await getSession();
  if (!session) return null;

  const env = getEnv();
  const repo = await getRepository();
  const accounts = await repo.listAccounts(session.userId);

  return (
    <>
      <SectionHeader
        title="Cuentas"
        description="Cada cuenta de Wallapop se gestiona por separado. Sus productos, anuncios, conversaciones y ventas nunca se mezclan."
      />

      {!env.WALLAPOP_INTEGRATION_ENABLED && (
        <div className="mb-6">
          <Notice tone="info" title="Integración con Wallapop desactivada">
            Las cuentas funcionan en modo demostración con datos ficticios. Para conectar cuentas
            reales necesitas credenciales de aplicación integradora de Wallapop.{' '}
            <Link href="/integracion" className="font-medium underline underline-offset-2">
              Ver qué se puede conectar y qué no
            </Link>
            .
          </Notice>
        </div>
      )}

      {accounts.length === 0 ? (
        <Surface>
          <EmptyState
            title="Aún no has añadido ninguna cuenta"
            description="Añade tu primera cuenta para empezar a organizar productos y anuncios. En modo demostración puedes crear cuentas ficticias sin conectar nada."
            action={
              <button type="button" className={buttonClass('primary')}>
                Añadir cuenta
              </button>
            }
          />
        </Surface>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const status = ACCOUNT_STATUS[account.status];
            const stats = account.stats;

            return (
              <Surface key={account.id} as="article" className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{account.name}</h2>
                    <p className="mt-0.5 font-mono text-2xs text-faint">{account.slug}</p>
                  </div>
                  <Pill tone={status.tone}>{status.label}</Pill>
                </div>

                {account.attentionReason && (
                  <p className="mt-3 text-xs leading-relaxed text-warning">
                    {account.attentionReason}
                  </p>
                )}

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-4">
                  <Stat label="Anuncios" value={formatNumber(stats.listings)} />
                  <Stat label="Activos" value={formatNumber(stats.activeListings)} />
                  <Stat label="Mensajes pendientes" value={formatNumber(stats.pendingMessages)} />
                  <Stat label="Ventas" value={formatNumber(stats.sales)} />
                  <Stat label="Ingresos" value={formatCurrency(stats.revenueCents)} />
                  <Stat
                    label="Última sincronización"
                    value={account.lastSyncedAt ? formatRelative(account.lastSyncedAt) : 'Nunca'}
                  />
                </dl>

                <div className="mt-5 flex gap-2">
                  <Link
                    href={`/anuncios?cuenta=${account.id}`}
                    className={buttonClass('secondary', 'flex-1 text-xs')}
                  >
                    Ver anuncios
                  </Link>
                  <Link
                    href={`/conversaciones?cuenta=${account.id}`}
                    className={buttonClass('ghost', 'flex-1 text-xs')}
                  >
                    Conversaciones
                  </Link>
                </div>
              </Surface>
            );
          })}
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs text-faint">{label}</dt>
      <dd className="tnum mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}
