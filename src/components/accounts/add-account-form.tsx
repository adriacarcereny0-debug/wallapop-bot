'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { EMPTY_FORM_STATE } from '@/lib/forms/state';
import { Notice, Surface, buttonClass } from '@/components/ui/primitives';
import { createAccount } from '@/app/(app)/cuentas/actions';

export function AddAccountForm() {
  const [state, action] = useActionState(createAccount, EMPTY_FORM_STATE);

  return (
    <Surface as="section" className="p-5">
      <h2 className="text-sm font-semibold">Añadir cuenta</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Da de alta aquí una cuenta de Wallapop que ya tengas. Después podrás conectarla.
      </p>

      <form action={action} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Nombre de la cuenta</span>
          <input
            name="name"
            required
            maxLength={60}
            placeholder="Tienda principal"
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm"
          />
          <span className="text-2xs text-faint">Sólo para identificarla aquí dentro.</span>
        </label>

        <SubmitButton />

        {state.error && <Notice tone="danger" title={state.error} />}
        {state.success && <Notice tone="success" title={state.success} />}
      </form>
    </Surface>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass('primary')}>
      {pending ? 'Añadiendo…' : 'Añadir cuenta'}
    </button>
  );
}
