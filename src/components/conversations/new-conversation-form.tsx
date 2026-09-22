'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Notice, Surface, buttonClass } from '@/components/ui/primitives';
import { createConversation } from '@/app/(app)/conversaciones/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms/state';

interface Option {
  id: string;
  name: string;
  accountId?: string;
}

/**
 * Alta manual de una conversación.
 *
 * Es el punto de entrada del modo asistente: Wallapop no deja leer el chat, así
 * que el vendedor pega aquí lo que ha recibido.
 */
export function NewConversationForm({
  accounts,
  listings,
}: {
  accounts: Option[];
  listings: Option[];
}) {
  const [state, action] = useActionState(createConversation, EMPTY_FORM_STATE);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');

  // Sólo se ofrecen los anuncios de la cuenta elegida: cruzarlos sería un error
  // de aislamiento y el servidor lo rechazaría igualmente.
  const available = listings.filter((listing) => listing.accountId === accountId);

  if (accounts.length === 0) {
    return (
      <Surface as="section" className="p-5">
        <h2 className="text-sm font-semibold">Registrar conversación</h2>
        <p className="mt-2 text-sm text-muted">
          Añade primero una cuenta en la sección «Cuentas».
        </p>
      </Surface>
    );
  }

  return (
    <Surface as="section" className="p-5">
      <h2 className="text-sm font-semibold">Registrar conversación</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Copia el mensaje que te ha llegado en Wallapop. La IA lo analizará y te propondrá una
        respuesta que tú revisarás.
      </p>

      <form action={action} className="mt-4 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Cuenta</span>
          <select
            name="accountId"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className={input}
            required
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Anuncio (opcional)</span>
          <select name="listingId" className={input}>
            <option value="">Sin anuncio asociado</option>
            {available.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Alias del comprador</span>
            <input name="buyerAlias" placeholder="Comprador A." required className={input} />
            <span className="text-2xs text-faint">No guardes datos personales.</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Prioridad</span>
            <select name="priority" defaultValue="normal" className={input}>
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Mensaje del comprador</span>
          <textarea
            name="firstMessage"
            rows={4}
            required
            placeholder="Hola, ¿aceptas 300 €?"
            className={input}
          />
        </label>

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
      {pending ? 'Registrando…' : 'Registrar conversación'}
    </button>
  );
}
