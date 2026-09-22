import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListingOptimizer } from '@/components/listings/optimizer';
import { Pill, SectionHeader, Surface, buttonClass } from '@/components/ui/primitives';
import { getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { formatCurrency, formatRelative } from '@/lib/format';
import { LISTING_STATUS } from '@/lib/labels';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) return null;

  const { id } = await params;
  const repo = await getRepository();

  // El repositorio filtra por userId: un id ajeno devuelve null, no el anuncio.
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
          <Surface className="p-5">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              Descripción
            </h2>
            <p className="mt-2.5 max-w-[68ch] text-sm leading-relaxed whitespace-pre-line">
              {listing.description || 'Este anuncio todavía no tiene descripción.'}
            </p>

            {listing.hashtags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {listing.hashtags.map((tag) => (
                  <Pill key={tag} tone="neutral">
                    #{tag}
                  </Pill>
                ))}
              </div>
            )}
          </Surface>

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

          {listing.attentionReason && (
            <Surface className="border-warning/35 bg-warning-soft p-4">
              <p className="text-sm font-semibold text-warning">Requiere revisión</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{listing.attentionReason}</p>
            </Surface>
          )}

          <Surface className="p-5">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              Publicación
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              Publicar o modificar este anuncio en Wallapop requiere la integración activada y la
              cuenta conectada por OAuth.
            </p>
            <Link href="/integracion" className={buttonClass('secondary', 'mt-3 w-full text-xs')}>
              Ver estado de la integración
            </Link>
          </Surface>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={`tnum ${strong ? 'font-semibold' : ''}`}>{value}</dd>
    </div>
  );
}
