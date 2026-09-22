import type { AccountFilter } from '@/types/domain';

/**
 * Lee el filtro de cuenta de los parámetros de URL.
 *
 * Se valida contra las cuentas reales del usuario: un `?cuenta=` manipulado no
 * puede usarse para mirar datos de otro. Si el valor no corresponde a ninguna
 * cuenta propia, se cae a «todas» en lugar de fallar.
 */
export function readAccountFilter(
  searchParams: Record<string, string | string[] | undefined>,
  ownedAccountIds: readonly string[],
): AccountFilter {
  const raw = searchParams.cuenta;
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (!value || value === 'all') return 'all';
  return ownedAccountIds.includes(value) ? value : 'all';
}
