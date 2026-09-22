import Link from 'next/link';
import { Suspense } from 'react';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import {
  EmptyState,
  SectionHeader,
  Surface,
  TableSkeleton,
  buttonClass,
} from '@/components/ui/primitives';
import { getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { formatCurrency, formatNumber, formatRelative } from '@/lib/format';
import { PRODUCT_CONDITION } from '@/lib/labels';

export const metadata = { title: 'Productos' };

export default function ProductsPage() {
  return (
    <>
      <SectionHeader
        title="Productos"
        description="Tu catálogo central. Un producto vive aquí una sola vez y desde él se preparan los anuncios de cada cuenta."
        action={
          <Link href="/productos/nuevo" className={buttonClass('primary')}>
            Nuevo producto
          </Link>
        }
      />
      <Surface className="overflow-hidden">
        <Suspense fallback={<TableSkeleton rows={6} />}>
          <ProductList />
        </Suspense>
      </Surface>
    </>
  );
}

async function ProductList() {
  const session = await getSession();
  if (!session) return null;

  const repo = await getRepository();
  const products = await repo.listProducts(session.userId);

  if (products.length === 0) {
    return (
      <EmptyState
        title="Tu catálogo está vacío"
        description="Añade tu primer producto con la información que tengas. La IA podrá redactar el anuncio después, pero sólo usará los datos que tú facilites."
        action={
          <Link href="/productos/nuevo" className={buttonClass('primary')}>
            Nuevo producto
          </Link>
        }
      />
    );
  }

  return (
    <>
      {/* Tabla en pantallas anchas */}
      <div className="hidden md:block">
        <Table>
          <THead>
            <TH>Producto</TH>
            <TH>Categoría</TH>
            <TH>Estado</TH>
            <TH align="right">Objetivo</TH>
            <TH align="right">Mínimo</TH>
            <TH align="right">Stock</TH>
            <TH align="right">Actualizado</TH>
          </THead>
          <TBody>
            {products.map((product) => (
              <TR key={product.id}>
                <TD>
                  <p className="font-medium">{product.name}</p>
                  <p className="mt-0.5 font-mono text-2xs text-faint">{product.sku}</p>
                </TD>
                <TD>
                  <span className="text-muted">{product.category}</span>
                </TD>
                <TD>
                  <span className="text-muted">{PRODUCT_CONDITION[product.condition]}</span>
                </TD>
                <TD align="right">{price(product.targetPriceCents)}</TD>
                <TD align="right">{price(product.minPriceCents)}</TD>
                <TD align="right">{formatNumber(product.stock)}</TD>
                <TD align="right">
                  <span className="text-2xs text-faint">{formatRelative(product.updatedAt)}</span>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {/* Lista en móvil: una tabla encogida sería ilegible */}
      <ul className="divide-y divide-line md:hidden">
        {products.map((product) => (
          <li key={product.id} className="px-4 py-3.5">
            <p className="font-medium">{product.name}</p>
            <p className="mt-0.5 font-mono text-2xs text-faint">{product.sku}</p>
            <div className="tnum mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>{product.category}</span>
              <span>{PRODUCT_CONDITION[product.condition]}</span>
              <span>Objetivo {price(product.targetPriceCents)}</span>
              <span>Stock {formatNumber(product.stock)}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Los precios opcionales se muestran como guion, no como «0 €». */
function price(cents: number | null): string {
  return cents === null ? '—' : formatCurrency(cents);
}
