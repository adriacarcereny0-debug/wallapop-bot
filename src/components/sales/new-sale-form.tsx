'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Notice, Surface, buttonClass } from '@/components/ui/primitives';
import { createSale } from '@/app/(app)/ventas/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms/state';

interface Option {
  id: string;
  name: string;
}

export function NewSaleForm({
  accounts,
  products,
}: {
  accounts: Option[];
  products: Option[];
}) {
  const [state, action] = useActionState(createSale, EMPTY_FORM_STATE);

  if (accounts.length === 0 || products.length === 0) {
    return (
      <Surface as="section" className="p-5">
        <h2 className="text-sm font-semibold">Registrar venta</h2>
        <p className="mt-2 text-sm text-muted">
          Necesitas al menos una cuenta y un producto para registrar una venta.
        </p>
      </Surface>
    );
  }

  return (
    <Surface as="section" className="p-5">
      <h2 className="text-sm font-semibold">Registrar venta</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Estas cifras son tu registro, no proceden de Wallapop.
      </p>

      <form action={action} className="mt-4 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Cuenta</span>
          <select name="accountId" className={input} required>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Producto</span>
          <select name="productId" className={input} required>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Importe</span>
            <input name="price" inputMode="decimal" placeholder="650" required className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Comprador</span>
            <input name="buyerAlias" placeholder="Comprador A." className={input} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Estado</span>
            <select name="status" defaultValue="completed" className={input}>
              <option value="pending">Pendiente</option>
              <option value="in_progress">En proceso</option>
              <option value="completed">Vendida</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Método</span>
            <select name="method" defaultValue="shipping" className={input}>
              <option value="shipping">Envío</option>
              <option value="in_person">En persona</option>
              <option value="other">Otro</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Notas</span>
          <textarea name="notes" rows={2} className={input} />
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
      {pending ? 'Registrando…' : 'Registrar venta'}
    </button>
  );
}
