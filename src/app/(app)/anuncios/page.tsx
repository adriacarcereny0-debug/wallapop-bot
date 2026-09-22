import Link from 'next/link';
import { Suspense } from 'react';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import {
  EmptyState,
  Pill,
  SectionHeader,
  Surface,
  TableSkeleton,
  buttonClass,
} from '@/components/ui/primitives';
import { readAccountFilter } from '@/lib/account-filter';
import { getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { formatCurrency, formatRelative } from '@/lib/format';
import { LISTING_STATUS } from '@/lib/labels';
import type { AccountWithStats, Listing, ListingStatus } from '@/types/domain';

export const metadata = { title: 'Anuncios' };

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'draft', label: 'Borradores' },
  { value: 'pending_review', label: 'Pendientes' },
  { value: 'sold', label: 'Vendidos' },
  { value: 'archived', label: 'Archivados' },
  { value: 'needs_attention', label: 'Requieren atención' },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default function ListingsPage({ searchParams }: PageProps) {
  return (
    <>
      <SectionHeader
        title="Anuncios"
        description="Todos los anuncios de tus cuentas. Cada uno pertenece a una sola cuenta y nunca se mezcla con las demás."
      />
      <Suspense
        fallback={
          <Surface className="overflow-hidden">
            <TableSkeleton rows={6} />
          </Surface>
        }
      >
        <ListingsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ListingsContent({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) return null;

  const params = await searchParams;
  const repo = await getRepository();
  const accounts = await repo.listAccounts(session.userId);
  const filter = readAccountFilter(params, accounts.map((a) => a.id));

  const all = await repo.listListings(session.userId, filter);

  const rawStatus = Array.isArray(params.estado) ? params.estado[0] : params.estado;
  const status = rawStatus && rawStatus in LISTING_STATUS ? (rawStatus as ListingStatus) : null;
  const listings = status ? all.filter((l) => l.status === status) : all;

  const counts = STATUS_FILTERS.map((option) => ({
    ...option,
    count:
      option.value === 'all'
        ? all.length
        : all.filter((l) => l.status === option.value).length,
  }));

  return (
    <>
      <div className="mb-4">
        <FilterTabs param="estado" options={counts} />
      </div>

      <Surface className="overflow-hidden">
        {listings.length === 0 ? (
          <EmptyState
            title={status ? 'Ningún anuncio en este estado' : 'Todavía no hay anuncios'}
            description={
              status
                ? 'Prueba con otro filtro o revisa todas las cuentas.'
                : 'Los anuncios se preparan desde un producto del catálogo. Se quedan en borrador hasta que tú los apruebas.'
            }
            action={
              !status && (
                <Link href="/productos" className={buttonClass('primary')}>
                  Ir al catálogo
                </Link>
              )
            }
          />
        ) : (
          <ListingTable listings={listings} accounts={accounts} />
        )}
      </Surface>
    </>
  );
}

function ListingTable({
  listings,
  accounts,
}: {
  listings: Listing[];
  accounts: AccountWithStats[];
}) {
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Cuenta';

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <THead>
            <TH>Anuncio</TH>
            <TH>Cuenta</TH>
            <TH>Estado</TH>
            <TH align="right">Precio</TH>
            <TH align="right">Actualizado</TH>
          </THead>
          <TBody>
            {listings.map((listing) => {
              const status = LISTING_STATUS[listing.status];
              return (
                <TR key={listing.id}>
                  <TD>
                    <Link
                      href={`/anuncios/${listing.id}`}
                      className="font-medium hover:text-accent"
                    >
                      {listing.title}
                    </Link>
                    {listing.attentionReason && (
                      <p className="mt-0.5 text-2xs text-warning">{listing.attentionReason}</p>
                    )}
                  </TD>
                  <TD>
                    <span className="text-muted">{accountName(listing.accountId)}</span>
                  </TD>
                  <TD>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </TD>
                  <TD align="right">{formatCurrency(listing.priceCents)}</TD>
                  <TD align="right">
                    <span className="text-2xs text-faint">
                      {formatRelative(listing.updatedAt)}
                    </span>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {listings.map((listing) => {
          const status = LISTING_STATUS[listing.status];
          return (
            <li key={listing.id} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/anuncios/${listing.id}`} className="font-medium">
                  {listing.title}
                </Link>
                <Pill tone={status.tone}>{status.label}</Pill>
              </div>
              <p className="tnum mt-1.5 text-xs text-muted">
                {accountName(listing.accountId)} · {formatCurrency(listing.priceCents)} ·{' '}
                {formatRelative(listing.updatedAt)}
              </p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
