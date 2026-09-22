'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Notice, Surface, buttonClass } from '@/components/ui/primitives';
import { editListing } from '@/app/(app)/anuncios/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms/state';

/**
 * Edición del contenido del anuncio.
 *
 * Guardar aquí NO envía nada a Wallapop: eso es un paso aparte y explícito en
 * el panel de publicación. Separarlos evita cambios accidentales en anuncios
 * que ya están online.
 */
export function ListingEditor({
  listingId,
  title,
  description,
  priceEuros,
  categoryLeafId,
}: {
  listingId: string;
  title: string;
  description: string;
  priceEuros: string;
  categoryLeafId: string | null;
}) {
  const [state, action] = useActionState(editListing, EMPTY_FORM_STATE);

  return (
    <Surface as="section" className="p-5">
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
        Contenido del anuncio
      </h2>

      <form action={action} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="listingId" value={listingId} />

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Título</span>
          <input name="title" defaultValue={title} maxLength={120} required className={input} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Descripción</span>
          <textarea name="description" defaultValue={description} rows={7} className={input} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Precio</span>
            <input
              name="price"
              defaultValue={priceEuros}
              inputMode="decimal"
              required
              className={input}
            />
            <span className="text-2xs text-faint">En euros. Ejemplo: 650 o 650,50</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Categoría de Wallapop</span>
            <input
              name="categoryLeafId"
              defaultValue={categoryLeafId ?? ''}
              placeholder="16000"
              className={input}
            />
            <span className="text-2xs text-faint">
              Obligatoria para publicar. Es el «category_leaf_id» de Wallapop.
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <SubmitButton />
          <span className="text-2xs text-faint">Guardar no envía nada a Wallapop.</span>
        </div>

        {state.error && <Notice tone="danger" title={state.error} />}
        {state.success && <Notice tone="success" title={state.success} />}
      </form>
    </Surface>
  );
}

const input = 'w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass('primary')}>
      {pending ? 'Guardando…' : 'Guardar cambios'}
    </button>
  );
}
