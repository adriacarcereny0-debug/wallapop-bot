'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { cx } from './primitives';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

/**
 * Filtro por estado. El valor viaja en la URL, igual que el de cuenta, para que
 * una vista filtrada se pueda compartir o recargar.
 */
export function FilterTabs({
  param,
  options,
  defaultValue = 'all',
}: {
  param: string;
  options: FilterOption[];
  defaultValue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = params.get(param) ?? defaultValue;

  function select(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === defaultValue) next.delete(param);
    else next.set(param, value);

    // Igual que en el filtro de cuenta: destino dinámico sobre la ruta actual.
    startTransition(() => router.push(`${pathname}${next.size ? `?${next}` : ''}` as Route));
  }

  return (
    <div
      role="tablist"
      aria-label="Filtrar por estado"
      className={cx('flex flex-wrap gap-1', pending && 'opacity-60')}
    >
      {options.map((option) => {
        const active = option.value === current;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => select(option.value)}
            className={cx(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150',
              active
                ? 'bg-accent-soft text-accent'
                : 'text-muted hover:bg-surface-sunken hover:text-ink',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="tnum ml-1.5 opacity-60">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
