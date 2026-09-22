import Link from 'next/link';
import { AddAccountForm } from '@/components/accounts/add-account-form';
import { ConnectGuide } from '@/components/accounts/connect-guide';
import {
  EmptyState,
  Notice,
  Pill,
  SectionHeader,
  Surface,
  buttonClass,
} from '@/components/ui/primitives';
import { getSession } from '@/lib/auth/session';
import { isWallapopConfigured } from '@/lib/config/env';
import { getRepository } from '@/lib/data';
import { formatCurrency, formatNumber, formatRelative } from '@/lib/format';
import { ACCOUNT_STATUS } from '@/lib/labels';
import { disconnectAccount } from './actions';

export const metadata = { title: 'Cuentas' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) return null;

  const params = await searchParams;
  const repo = await getRepository();
  const accounts = await repo.listAccounts(session.userId);
  const configured = isWallapopConfigured();

  const connected = first(params.conectada);
  const failed = first(params.error);

  return (
    <>
      <SectionHeader
        title="Cuentas"
        description="Cada cuenta de Wallapop se gestiona por separado. Sus productos, anuncios, conversaciones y ventas nunca se mezclan."
      />

      <div className="mb-6 flex flex-col gap-3">
        {connected && <Notice tone="success" title={connected} />}
        {failed && <Notice tone="danger" title={failed} />}

        {!configured && (
          <Notice tone="warning" title="Todavía no se pueden conectar cuentas">
            Falta dar de alta esta aplicación como integradora ante Wallapop y configurar sus
            credenciales en el servidor. Mientras tanto puedes usar el resto del panel: catálogo,
            anuncios en borrador, conversaciones y ventas funcionan con normalidad.{' '}
            <Link href="/integracion" className="font-medium underline underline-offset-2">
              Ver qué se puede automatizar y qué no
            </Link>
            .
          </Notice>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start [&>*]:min-w-0">
        <div className="flex flex-col gap-4">
          {accounts.length === 0 ? (
            <Surface>
              <EmptyState
                title="Aún no has añadido ninguna cuenta"
                description="Añade tu primera cuenta de Wallapop para empezar a organizar productos y anuncios. Sigue los pasos de la guía."
              />
            </Surface>
          ) : (
            accounts.map((account) => {
              const status = ACCOUNT_STATUS[account.status];
              const stats = account.stats;
              const isConnected = account.status === 'connected';

              return (
                <Surface key={account.id} as="article" className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
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

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-4 sm:grid-cols-3">
                    <Stat label="Anuncios" value={formatNumber(stats.listings)} />
                    <Stat label="Activos" value={formatNumber(stats.activeListings)} />
                    <Stat label="Mensajes" value={formatNumber(stats.pendingMessages)} />
                    <Stat label="Ventas" value={formatNumber(stats.sales)} />
                    <Stat label="Ingresos" value={formatCurrency(stats.revenueCents)} />
                    <Stat
                      label="Última sincronización"
                      value={
                        account.lastSyncedAt ? formatRelative(account.lastSyncedAt) : 'Nunca'
                      }
                    />
                  </dl>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {isConnected ? (
                      <form action={disconnectAccount}>
                        <input type="hidden" name="accountId" value={account.id} />
                        <button type="submit" className={buttonClass('danger', 'text-xs')}>
                          Desconectar
                        </button>
                      </form>
                    ) : configured ? (
                      <a
                        href={`/api/wallapop/oauth/start?cuenta=${account.id}`}
                        className={buttonClass('primary', 'text-xs')}
                      >
                        Conectar con Wallapop
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Faltan las credenciales de integrador en el servidor"
                        className={buttonClass('secondary', 'text-xs')}
                      >
                        Conectar con Wallapop
                      </button>
                    )}

                    <Link
                      href={`/anuncios?cuenta=${account.id}`}
                      className={buttonClass('secondary', 'text-xs')}
                    >
                      Ver anuncios
                    </Link>
                    <Link
                      href={`/conversaciones?cuenta=${account.id}`}
                      className={buttonClass('ghost', 'text-xs')}
                    >
                      Conversaciones
                    </Link>
                  </div>
                </Surface>
              );
            })
          )}
        </div>

        <div className="flex flex-col gap-4">
          <AddAccountForm />
          <ConnectGuide configured={configured} />
        </div>
      </div>
    </>
  );
}

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw : null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs text-faint">{label}</dt>
      <dd className="tnum mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}
