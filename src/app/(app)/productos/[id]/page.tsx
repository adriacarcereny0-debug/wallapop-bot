import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CreateListingForm } from '@/components/listings/create-listing-form';
import { ImageManager } from '@/components/products/image-manager';
import { Pill, SectionHeader, Surface, buttonClass } from '@/components/ui/primitives';
import { getSession } from '@/lib/auth/session';
import { isImageEnhancementConfigured } from '@/lib/config/env';
import { getRepository } from '@/lib/data';
import { formatCurrency, formatNumber, formatRelative } from '@/lib/format';
import { LISTING_STATUS, PRODUCT_CONDITION } from '@/lib/labels';
import { deleteProduct } from '../actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) return null;

  const { id } = await params;
  const repo = await getRepository();

  const product = await repo.getProduct(session.userId, id);
  if (!product) notFound();

  const [accounts, allListings] = await Promise.all([
    repo.listAccounts(session.userId),
    repo.listListings(session.userId, 'all'),
  ]);

  const listings = allListings.filter((listing) => listing.productId === product.id);

  return (
    <>
      <div className="mb-4">
        <Link href="/productos" className="text-xs text-muted hover:text-ink">
          ← Volver al catálogo
        </Link>
      </div>

      <SectionHeader
        title={product.name}
        description={`${product.sku} · ${product.category} · actualizado ${formatRelative(product.updatedAt)}`}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start [&>*]:min-w-0">
        <div className="flex flex-col gap-6">
          <ImageManager
            productId={product.id}
            images={product.images}
            enhancementAvailable={isImageEnhancementConfigured()}
          />

          <Surface as="section" className="p-5">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              Ficha del producto
            </h2>

            <dl className="mt-3.5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Marca" value={product.brand ?? '—'} />
              <Field label="Modelo" value={product.model ?? '—'} />
              <Field label="Categoría" value={product.category} />
              <Field label="Subcategoría" value={product.subcategory ?? '—'} />
              <Field label="Estado" value={PRODUCT_CONDITION[product.condition]} />
              <Field label="Stock" value={formatNumber(product.stock)} />
            </dl>

            {Object.keys(product.features).length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-2xs font-semibold tracking-wide text-muted uppercase">
                  Características declaradas
                </p>
                <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {Object.entries(product.features).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3 text-sm">
                      <dt className="text-muted">{key}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {product.publicDescription && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-2xs font-semibold tracking-wide text-muted uppercase">
                  Descripción pública
                </p>
                <p className="mt-1.5 max-w-[68ch] text-sm leading-relaxed whitespace-pre-line">
                  {product.publicDescription}
                </p>
              </div>
            )}

            {product.internalNotes && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-2xs font-semibold tracking-wide text-muted uppercase">
                  Notas internas · privadas
                </p>
                <p className="mt-1.5 max-w-[68ch] text-sm leading-relaxed text-muted">
                  {product.internalNotes}
                </p>
              </div>
            )}
          </Surface>
        </div>

        <div className="flex flex-col gap-4">
          <Surface className="p-5">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Precios</h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <Row label="Compra" value={price(product.purchasePriceCents)} />
              <Row label="Objetivo" value={price(product.targetPriceCents)} strong />
              <Row label="Mínimo" value={price(product.minPriceCents)} />
            </dl>
            <p className="mt-3 text-2xs leading-relaxed text-faint">
              El asistente de negociación nunca recomendará bajar del mínimo.
            </p>
          </Surface>

          <CreateListingForm
            productId={product.id}
            accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
            defaultTitle={product.name}
            defaultDescription={product.publicDescription ?? ''}
            defaultPriceEuros={
              product.targetPriceCents
                ? (product.targetPriceCents / 100).toFixed(2).replace('.', ',')
                : ''
            }
          />

          {listings.length > 0 && (
            <Surface className="overflow-hidden">
              <h2 className="border-b border-line px-5 py-3.5 text-xs font-semibold tracking-wide text-muted uppercase">
                Anuncios de este producto
              </h2>
              <ul className="divide-y divide-line">
                {listings.map((listing) => {
                  const status = LISTING_STATUS[listing.status];
                  const account = accounts.find((a) => a.id === listing.accountId);
                  return (
                    <li
                      key={listing.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/anuncios/${listing.id}`}
                          className="truncate text-sm font-medium hover:text-accent"
                        >
                          {listing.title}
                        </Link>
                        <p className="tnum mt-0.5 text-2xs text-faint">
                          {account?.name ?? 'Cuenta'} · {formatCurrency(listing.priceCents)}
                        </p>
                      </div>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </li>
                  );
                })}
              </ul>
            </Surface>
          )}

          <Surface className="p-5">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              Zona peligrosa
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Eliminar el producto borra también sus fotografías y sus anuncios en esta
              aplicación. No borra nada que ya esté publicado en Wallapop.
            </p>
            <form action={deleteProduct} className="mt-3">
              <input type="hidden" name="productId" value={product.id} />
              <button type="submit" className={buttonClass('danger', 'w-full text-xs')}>
                Eliminar producto
              </button>
            </form>
          </Surface>
        </div>
      </div>
    </>
  );
}

function price(cents: number | null): string {
  return cents === null ? '—' : formatCurrency(cents);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs text-faint">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
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
