import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListingEditor } from '@/components/listings/listing-editor';
import { ListingOptimizer } from '@/components/listings/optimizer';
import { PublishPanel } from '@/components/listings/publish-panel';
import { Pill, SectionHeader, Surface } from '@/components/ui/primitives';
import { getSession } from '@/lib/auth/session';
import { isWallapopConfigured } from '@/lib/config/env';
import { getRepository } from '@/lib/data';
import { formatCurrency, formatRelative } from '@/lib/format';
import { LISTING_STATUS } from '@/lib/labels';
import type { Listing, Product } from '@/types/domain';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) return null;

  const { id } = await params;
  const repo = await getRepository();

  // getListing filtra por userId: un id ajeno devuelve null, no el anuncio.
  const listing = await repo.getListing(session.userId, id);
  if (!listing) notFound();

  const [product, account] = await Promise.all([
    repo.getProduct(session.userId, listing.productId),
    repo.getAccount(session.userId, listing.accountId),
  ]);

  const status = LISTING_STATUS[listing.status];

  return (
    <>
      <div className="mb-4">
        <Link href="/anuncios" className="text-xs text-muted hover:text-ink">
          ← Volver a anuncios
        </Link>
      </div>

      <SectionHeader
        title={listing.title}
        description={`${account?.name ?? 'Cuenta'} · actualizado ${formatRelative(listing.updatedAt)}`}
        action={<Pill tone={status.tone}>{status.label}</Pill>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start [&>*]:min-w-0">
        <div className="flex flex-col gap-6">
          <ListingEditor
            listingId={listing.id}
            title={listing.title}
            description={listing.description}
            priceEuros={(listing.priceCents / 100).toFixed(2).replace('.', ',')}
            categoryLeafId={listing.categoryLeafId}
          />

          <ListingOptimizer
            title={listing.title}
            description={listing.description}
            priceCents={listing.priceCents}
            category={product?.category ?? 'Sin categoría'}
            photoCount={product?.images.length ?? 0}
            features={product?.features ?? {}}
          />
        </div>

        <div className="flex flex-col gap-4">
          <PublishPanel
            listingId={listing.id}
            externalItemId={listing.externalItemId}
            accountConnected={account?.status === 'connected'}
            integrationConfigured={isWallapopConfigured()}
            blockers={findBlockers(listing, product)}
          />

          <Surface className="p-5">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Precios</h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <Row label="Publicado" value={formatCurrency(listing.priceCents)} strong />
              {product?.targetPriceCents != null && (
                <Row label="Objetivo" value={formatCurrency(product.targetPriceCents)} />
              )}
              {product?.minPriceCents != null && (
                <Row label="Mínimo" value={formatCurrency(product.minPriceCents)} />
              )}
            </dl>
            <p className="mt-3 text-2xs leading-relaxed text-faint">
              El objetivo y el mínimo son internos: nunca se muestran al comprador ni se envían a
              Wallapop.
            </p>
          </Surface>

          {product && (
            <Surface className="p-5">
              <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
                Producto
              </h2>
              <p className="mt-2.5 text-sm font-medium">{product.name}</p>
              <p className="mt-0.5 font-mono text-2xs text-faint">{product.sku}</p>
              <p className="mt-2 text-xs text-muted">
                {product.images.length} fotografía(s) · {product.category}
              </p>
              <Link
                href={`/productos/${product.id}`}
                className="mt-3 inline-block text-xs text-accent hover:underline"
              >
                Abrir producto →
              </Link>
            </Surface>
          )}

          {listing.attentionReason && (
            <Surface className="border-warning/35 bg-warning-soft p-4">
              <p className="text-sm font-semibold text-warning">Requiere revisión</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{listing.attentionReason}</p>
            </Surface>
          )}
        </div>
      </div>
    </>
  );
}

/** Requisitos que Wallapop exige y que el anuncio todavía no cumple. */
function findBlockers(listing: Listing, product: Product | null): string[] {
  const blockers: string[] = [];

  if (!listing.description.trim()) blockers.push('Falta la descripción.');
  if (listing.priceCents <= 0) blockers.push('El precio debe ser mayor que cero.');
  if (!listing.categoryLeafId) blockers.push('Falta la categoría de Wallapop.');
  if (!product || product.images.length === 0) {
    blockers.push('El producto necesita al menos una fotografía.');
  }

  return blockers;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={`tnum ${strong ? 'font-semibold' : ''}`}>{value}</dd>
    </div>
  );
}
