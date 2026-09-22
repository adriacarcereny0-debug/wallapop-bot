import Link from 'next/link';
import { Suspense } from 'react';
import {
  EmptyState,
  Pill,
  SectionHeader,
  Skeleton,
  Surface,
  buttonClass,
} from '@/components/ui/primitives';
import { readAccountFilter } from '@/lib/account-filter';
import { getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { formatCurrency, formatNumber, formatRelative, formatTime } from '@/lib/format';
import { ACCOUNT_STATUS } from '@/lib/labels';
import type { DashboardSummary } from '@/types/domain';

export const metadata = { title: 'Panel' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  return (
    <>
      <SectionHeader
        title="Panel"
        description="Estado de todas tus cuentas, lo que requiere tu atención y la actividad reciente."
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DashboardContent({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) return null;

  const repo = await getRepository();
  const accounts = await repo.listAccounts(session.userId);
  const filter = readAccountFilter(await searchParams, accounts.map((a) => a.id));
  const summary = await repo.getDashboardSummary(session.userId, filter);

  return (
    <div className="flex flex-col gap-8">
      <Metrics summary={summary} />

      {summary.alerts.length > 0 && <Alerts alerts={summary.alerts} />}

      {/* min-w-0 en los hijos: sin él, un elemento de rejilla no baja de su
          ancho de contenido mínimo y desborda la columna en móvil. */}
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] [&>*]:min-w-0">
        <RecentActivity summary={summary} />
        <div className="flex flex-col gap-6">
          <PendingApprovals summary={summary} />
          <Accounts summary={summary} />
        </div>
      </div>
    </div>
  );
}

/**
 * Cifras principales.
 *
 * No es la plantilla de «métrica héroe»: las tres cifras que mueven el negocio
 * (ingresos, activos, pendientes) reciben más peso, y las secundarias van en
 * una fila densa debajo. Jerarquía por escala, no por color ni degradados.
 */
function Metrics({ summary }: { summary: DashboardSummary }) {
  const primary = [
    { label: 'Ingresos registrados', value: formatCurrency(summary.revenueCents) },
    { label: 'Anuncios activos', value: formatNumber(summary.activeListings) },
    { label: 'Mensajes pendientes', value: formatNumber(summary.pendingMessages) },
  ];

  const secondary = [
    { label: 'Productos', value: summary.totalProducts },
    { label: 'Anuncios', value: summary.totalListings },
    { label: 'Borradores', value: summary.draftListings },
    { label: 'Pendientes de revisión', value: summary.pendingReviewListings },
    { label: 'Ventas', value: summary.sales },
  ];

  return (
    <section aria-label="Cifras principales">
      <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        {primary.map((metric) => (
          <div key={metric.label} className="bg-surface px-5 py-6">
            <p className="text-xs font-medium text-muted">{metric.label}</p>
            <p className="tnum mt-2 text-3xl font-semibold tracking-tight">{metric.value}</p>
          </div>
        ))}
      </div>

      <dl className="mt-px grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5">
        {secondary.map((metric) => (
          <div key={metric.label} className="bg-surface px-4 py-3.5">
            <dt className="text-2xs text-muted">{metric.label}</dt>
            <dd className="tnum mt-0.5 text-lg font-semibold">{formatNumber(metric.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Alerts({ alerts }: { alerts: DashboardSummary['alerts'] }) {
  return (
    <section aria-label="Alertas" className="flex flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={
            'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ' +
            (alert.severity === 'critical'
              ? 'border-danger/35 bg-danger-soft'
              : 'border-warning/35 bg-warning-soft')
          }
        >
          <div>
            <p
              className={
                'text-sm font-semibold ' +
                (alert.severity === 'critical' ? 'text-danger' : 'text-warning')
              }
            >
              {alert.title}
            </p>
            <p className="mt-0.5 text-xs text-muted">{alert.detail}</p>
          </div>
          <Link href="/cuentas" className={buttonClass('secondary', 'shrink-0')}>
            Revisar
          </Link>
        </div>
      ))}
    </section>
  );
}

function RecentActivity({ summary }: { summary: DashboardSummary }) {
  return (
    <Surface as="section" className="overflow-hidden">
      <h2 className="border-b border-line px-5 py-3.5 text-xs font-semibold tracking-wide text-muted uppercase">
        Actividad reciente
      </h2>

      {summary.recentActivity.length === 0 ? (
        <EmptyState
          title="Todavía no hay actividad"
          description="Aquí aparecerá lo que vaya ocurriendo: contenido generado por IA, anuncios preparados y cuentas que necesiten atención."
        />
      ) : (
        <ol className="divide-y divide-line">
          {summary.recentActivity.map((entry) => (
            <li key={entry.id} className="flex gap-4 px-5 py-3">
              <time
                dateTime={entry.createdAt}
                className="tnum w-11 shrink-0 pt-0.5 text-xs text-faint"
              >
                {formatTime(entry.createdAt)}
              </time>
              <p className="text-sm leading-relaxed">{entry.message}</p>
            </li>
          ))}
        </ol>
      )}
    </Surface>
  );
}

function PendingApprovals({ summary }: { summary: DashboardSummary }) {
  return (
    <Surface as="section" className="overflow-hidden">
      <h2 className="border-b border-line px-5 py-3.5 text-xs font-semibold tracking-wide text-muted uppercase">
        Pendiente de tu aprobación
      </h2>

      {summary.pendingApprovals.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">
          No hay nada esperando tu revisión. Todo lo que genera la IA pasa por aquí antes de
          usarse.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {summary.pendingApprovals.map((approval) => (
            <li key={approval.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{approval.summary}</p>
                <p className="mt-0.5 text-2xs text-faint">
                  {formatRelative(approval.createdAt)}
                </p>
              </div>
              <Link
                href={`/anuncios/${approval.subjectId}`}
                className={buttonClass('secondary', 'shrink-0 px-2.5 py-1 text-xs')}
              >
                Revisar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

function Accounts({ summary }: { summary: DashboardSummary }) {
  return (
    <Surface as="section" className="overflow-hidden">
      <h2 className="border-b border-line px-5 py-3.5 text-xs font-semibold tracking-wide text-muted uppercase">
        Estado de las cuentas
      </h2>

      <ul className="divide-y divide-line">
        {summary.accounts.map((account) => {
          const status = ACCOUNT_STATUS[account.status];
          return (
            <li key={account.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{account.name}</p>
                <p className="tnum mt-0.5 text-2xs text-faint">
                  {formatNumber(account.stats.listings)} anuncios ·{' '}
                  {formatNumber(account.stats.pendingMessages)} mensajes
                </p>
              </div>
              <Pill tone={status.tone}>{status.label}</Pill>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-label="Cargando el panel">
      <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="bg-surface px-5 py-6">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] [&>*]:min-w-0">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}
