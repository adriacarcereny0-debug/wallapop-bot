import { Suspense } from 'react';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import {
  EmptyState,
  Pill,
  SectionHeader,
  Surface,
  TableSkeleton,
} from '@/components/ui/primitives';
import { NewSaleForm } from '@/components/sales/new-sale-form';
import { readAccountFilter } from '@/lib/account-filter';
import { getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { formatCurrency, formatDate } from '@/lib/format';
import { SALE_METHOD, SALE_STATUS } from '@/lib/labels';

export const metadata = { title: 'Ventas' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default function SalesPage({ searchParams }: PageProps) {
  return (
    <>
      <SectionHeader
        title="Ventas"
        description="Registro de tus ventas por cuenta y producto. Estos datos son tuyos: no proceden de ninguna métrica de Wallapop."
      />
      <Suspense
        fallback={
          <Surface className="overflow-hidden">
            <TableSkeleton rows={5} />
          </Surface>
        }
      >
        <SalesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SalesContent({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) return null;

  const repo = await getRepository();
  const accounts = await repo.listAccounts(session.userId);
  const filter = readAccountFilter(await searchParams, accounts.map((a) => a.id));

  const [sales, products] = await Promise.all([
    repo.listSales(session.userId, filter),
    repo.listProducts(session.userId),
  ]);

  const form = (
    <NewSaleForm
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      products={products.map((p) => ({ id: p.id, name: p.name }))}
    />
  );

  if (sales.length === 0) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start [&>*]:min-w-0">
        <Surface>
          <EmptyState
            title="Todavía no has registrado ventas"
            description="Registra cada venta para llevar el control de ingresos por cuenta y saber qué productos funcionan mejor."
          />
        </Surface>
        {form}
      </div>
    );
  }

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? 'Producto';
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Cuenta';

  const total = sales
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.priceCents, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start [&>*]:min-w-0">
      <Surface className="overflow-hidden">
      <div className="hidden md:block">
        <Table>
          <THead>
            <TH>Producto</TH>
            <TH>Cuenta</TH>
            <TH>Comprador</TH>
            <TH>Método</TH>
            <TH>Estado</TH>
            <TH align="right">Importe</TH>
            <TH align="right">Fecha</TH>
          </THead>
          <TBody>
            {sales.map((sale) => {
              const status = SALE_STATUS[sale.status];
              return (
                <TR key={sale.id}>
                  <TD>
                    <span className="font-medium">{productName(sale.productId)}</span>
                  </TD>
                  <TD>
                    <span className="text-muted">{accountName(sale.accountId)}</span>
                  </TD>
                  <TD>
                    <span className="text-muted">{sale.buyerAlias ?? '—'}</span>
                  </TD>
                  <TD>
                    <span className="text-muted">{SALE_METHOD[sale.method]}</span>
                  </TD>
                  <TD>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </TD>
                  <TD align="right">{formatCurrency(sale.priceCents)}</TD>
                  <TD align="right">
                    <span className="text-2xs text-faint">{formatDate(sale.soldAt)}</span>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        <div className="flex justify-between border-t border-line bg-surface-sunken px-4 py-3">
          <span className="text-xs font-semibold text-muted">Total de ventas completadas</span>
          <span className="tnum text-sm font-semibold">{formatCurrency(total)}</span>
        </div>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {sales.map((sale) => {
          const status = SALE_STATUS[sale.status];
          return (
            <li key={sale.id} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{productName(sale.productId)}</p>
                <Pill tone={status.tone}>{status.label}</Pill>
              </div>
              <p className="tnum mt-1.5 text-xs text-muted">
                {accountName(sale.accountId)} · {formatCurrency(sale.priceCents)} ·{' '}
                {formatDate(sale.soldAt)}
              </p>
            </li>
          );
        })}
      </ul>
      </Surface>
      {form}
    </div>
  );
}
