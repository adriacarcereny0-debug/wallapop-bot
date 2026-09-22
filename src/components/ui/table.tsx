import type { ReactNode } from 'react';
import { cx } from './primitives';

/**
 * Tabla de datos.
 *
 * En móvil no se fuerza el scroll horizontal de una tabla completa: el patrón
 * habitual de «tabla encogida» es ilegible. Las vistas que la usan ofrecen una
 * disposición de lista por debajo del punto de ruptura.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-surface-sunken">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cx(
        'px-4 py-2.5 text-2xs font-semibold tracking-wide text-muted uppercase',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({ children }: { children: ReactNode }) {
  return <tr className="transition-colors duration-150 hover:bg-surface-sunken">{children}</tr>;
}

export function TD({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td
      className={cx(
        'px-4 py-3 align-middle',
        align === 'right' ? 'tnum text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </td>
  );
}
