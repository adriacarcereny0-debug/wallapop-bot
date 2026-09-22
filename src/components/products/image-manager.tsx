'use client';

import Image from 'next/image';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { EMPTY_FORM_STATE } from '@/lib/forms/state';
import { Notice, Pill, Surface, buttonClass } from '@/components/ui/primitives';
import {
  deleteProductImage,
  enhanceProductImage,
  uploadProductImage,
} from '@/app/(app)/productos/actions';
import type { ProductImage } from '@/types/domain';

const EDITS = [
  { value: 'neutral_background', label: 'Fondo neutro' },
  { value: 'lighting', label: 'Mejorar iluminación' },
  { value: 'straighten', label: 'Enderezar' },
] as const;

/**
 * Gestión de las fotografías de un producto.
 *
 * Las versiones mejoradas se añaden junto a la original y se marcan como tales.
 * La original nunca se sustituye: poder comparar con la foto real es lo que
 * mantiene honesta la función.
 */
export function ImageManager({
  productId,
  images,
  enhancementAvailable,
}: {
  productId: string;
  images: ProductImage[];
  enhancementAvailable: boolean;
}) {
  const [uploadState, upload] = useActionState(uploadProductImage, EMPTY_FORM_STATE);
  const [enhanceState, enhance] = useActionState(enhanceProductImage, EMPTY_FORM_STATE);

  return (
    <Surface as="section" className="p-5">
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Fotografías</h2>
      <p className="mt-1.5 max-w-[68ch] text-xs leading-relaxed text-muted">
        Wallapop exige al menos una fotografía para publicar. La primera es la que verá el
        comprador en el listado.
      </p>

      <form action={upload} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="productId" value={productId} />
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium">Añadir fotografía</span>
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-surface-sunken file:px-2.5 file:py-1 file:text-xs"
          />
        </label>
        <UploadButton />
      </form>

      {uploadState.error && (
        <div className="mt-3">
          <Notice tone="danger" title={uploadState.error} />
        </div>
      )}
      {enhanceState.error && (
        <div className="mt-3">
          <Notice tone="danger" title={enhanceState.error} />
        </div>
      )}
      {enhanceState.success && (
        <div className="mt-3">
          <Notice tone="success" title={enhanceState.success} />
        </div>
      )}

      {images.length === 0 ? (
        <p className="mt-5 text-sm text-muted">
          Todavía no hay fotografías. Sube al menos una para poder publicar el anuncio.
        </p>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {images.map((image, index) => (
            <li key={image.id} className="rounded-lg border border-line p-3">
              <div className="relative aspect-4/3 overflow-hidden rounded-md bg-surface-sunken">
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 320px"
                  className="object-contain"
                  unoptimized
                />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {index === 0 && <Pill tone="accent">Principal</Pill>}
                <Pill tone={image.kind === 'enhanced' ? 'info' : 'neutral'}>
                  {image.kind === 'enhanced' ? (image.transformation ?? 'Mejorada') : 'Original'}
                </Pill>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {image.kind === 'original' && enhancementAvailable && (
                  <form action={enhance} className="flex flex-wrap gap-1.5">
                    <input type="hidden" name="productId" value={productId} />
                    <input type="hidden" name="imageId" value={image.id} />
                    <select
                      name="edit"
                      className="rounded-md border border-line-strong bg-surface px-2 py-1 text-2xs"
                    >
                      {EDITS.map((edit) => (
                        <option key={edit.value} value={edit.value}>
                          {edit.label}
                        </option>
                      ))}
                    </select>
                    <EnhanceButton />
                  </form>
                )}

                <form action={deleteProductImage}>
                  <input type="hidden" name="productId" value={productId} />
                  <input type="hidden" name="imageId" value={image.id} />
                  <button type="submit" className={buttonClass('ghost', 'px-2 py-1 text-2xs')}>
                    Eliminar
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!enhancementAvailable && images.length > 0 && (
        <p className="mt-4 text-2xs leading-relaxed text-faint">
          La mejora por IA está desactivada. Define{' '}
          <code className="font-mono">IMAGE_PROVIDER</code> y su clave para activarla.
        </p>
      )}

      <p className="mt-4 border-t border-line pt-3 text-2xs leading-relaxed text-faint">
        Las ediciones disponibles sólo corrigen fondo, luz y encuadre. No se puede borrar un
        arañazo, añadir accesorios ni cambiar el color: eso induciría a error al comprador.
      </p>
    </Surface>
  );
}

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass('secondary', 'text-xs')}>
      {pending ? 'Subiendo…' : 'Subir'}
    </button>
  );
}

function EnhanceButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass('secondary', 'px-2 py-1 text-2xs')}
    >
      {pending ? 'Generando…' : 'Mejorar'}
    </button>
  );
}
