'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { AccountWithStats } from '@/types/domain';
import { cx } from '@/components/ui/primitives';

/**
 * Selector global de cuenta.
 *
 * Vive en la cabecera y se ve en todas las pantallas: confundir dos cuentas es
 * el error más caro que puede cometer el usuario (principio 1 de PRODUCT.md).
 * El valor viaja en la URL (`?cuenta=`), de modo que cualquier vista es
 * compartible y recargable sin perder el contexto.
 */
export function AccountFilter({ accounts }: { accounts: AccountWithStats[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = params.get('cuenta') ?? 'all';

  function change(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === 'all') next.delete('cuenta');
    else next.set('cuenta', value);

    // El destino se construye a partir de la ruta actual, así que las rutas
    // tipadas no pueden verificarlo estáticamente.
    startTransition(() => {
      router.push(`${pathname}${next.size ? `?${next}` : ''}` as Route);
    });
  }

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Filtrar por cuenta</span>
      <select
        value={current}
        onChange={(event) => change(event.target.value)}
        disabled={pending}
        className={cx(
          'rounded-md border border-line-strong bg-surface py-1.5 pr-8 pl-3',
          'text-sm font-medium transition-opacity',
          pending && 'opacity-60',
        )}
      >
        <option value="all">Todas las cuentas</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
    </label>
  );
}
