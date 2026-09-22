'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { EMPTY_FORM_STATE } from '@/lib/forms/state';
import { Notice, Surface, buttonClass } from '@/components/ui/primitives';
import { createListing } from '@/app/(app)/anuncios/actions';

interface AccountOption {
  id: string;
  name: string;
}

/**
 * Crea un anuncio a partir de un producto del catálogo.
 *
 * El anuncio nace como borrador: publicar es un paso aparte, deliberado, desde
 * la ficha del anuncio.
 */
export function CreateListingForm({
  productId,
  accounts,
  defaultTitle,
  defaultDescription,
  defaultPriceEuros,
}: {
  productId: string;
  accounts: AccountOption[];
  defaultTitle: string;
  defaultDescription: string;
  defaultPriceEuros: string;
}) {
  const [state, action] = useActionState(createListing, EMPTY_FORM_STATE);

  if (accounts.length === 0) {
    return (
      <Surface as="section" className="p-5">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
          Crear anuncio
        </h2>
        <p className="mt-2.5 text-sm text-muted">
          Necesitas al menos una cuenta para crear un anuncio. Añádela en la sección «Cuentas».
        </p>
      </Surface>
    );
  }

  return (
    <Surface as="section" className="p-5">
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Crear anuncio</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        Se guardará como borrador en la cuenta que elijas. No se publica nada todavía.
      </p>

      <form action={action} className="mt-4 flex flex-col gap-3.5">
        <input type="hidden" name="productId" value={productId} />

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Cuenta de destino</span>
          <select name="accountId" className={input} required>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Título</span>
          <input name="title" defaultValue={defaultTitle} maxLength={120} required className={input} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Descripción</span>
          <textarea name="description" defaultValue={defaultDescription} rows={4} className={input} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Precio</span>
            <input
              name="price"
              defaultValue={defaultPriceEuros}
              inputMode="decimal"
              required
              className={input}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Categoría Wallapop</span>
            <input name="categoryLeafId" placeholder="16000" className={input} />
          </label>
        </div>

        <SubmitButton />

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
      {pending ? 'Creando…' : 'Crear borrador de anuncio'}
    </button>
  );
}
