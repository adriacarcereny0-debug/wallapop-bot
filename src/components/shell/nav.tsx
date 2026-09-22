'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui/primitives';

export interface NavItem {
  href: Route;
  label: string;
  /** Contador opcional (mensajes pendientes, etc.). */
  badge?: number;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/panel', label: 'Panel' },
  { href: '/cuentas', label: 'Cuentas' },
  { href: '/productos', label: 'Productos' },
  { href: '/anuncios', label: 'Anuncios' },
  { href: '/conversaciones', label: 'Conversaciones' },
  { href: '/ventas', label: 'Ventas' },
  { href: '/estudio', label: 'Estudio de IA' },
  { href: '/integracion', label: 'Integración' },
  { href: '/ajustes', label: 'Ajustes' },
];

export function SidebarNav({ counts }: { counts?: Record<string, number> }) {
  const pathname = usePathname();

  return (
    /* En móvil la navegación es una tira horizontal desplazable: apilada
       verticalmente empujaba el contenido por debajo del pliegue. */
    <nav
      aria-label="Navegación principal"
      className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const badge = counts?.[item.href];

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2',
              'text-sm whitespace-nowrap transition-colors duration-150',
              active
                ? 'bg-accent-soft font-semibold text-accent'
                : 'text-muted hover:bg-surface-sunken hover:text-ink',
            )}
          >
            <span>{item.label}</span>
            {badge !== undefined && badge > 0 && (
              <span className="tnum rounded-full bg-warning-soft px-1.5 py-0.5 text-2xs font-semibold text-warning">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
