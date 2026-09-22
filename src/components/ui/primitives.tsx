import type { ReactNode } from 'react';

/** Une clases condicionales sin arrastrar una dependencia por ello. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ── Pastilla de estado ───────────────────────────────────────────────────────

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

/**
 * Indicador de estado. Fondo tenue del color semántico.
 * Nunca una barra lateral de color: ver las prohibiciones de DESIGN.md.
 */
export function Pill({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5',
        'text-2xs font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}

// ── Superficie ───────────────────────────────────────────────────────────────

/** Contenedor base. Se usa sólo cuando el contenido es una unidad real. */
export function Surface({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Tag className={cx('rounded-lg border border-line bg-surface', className)}>{children}</Tag>
  );
}

// ── Cabecera de sección ──────────────────────────────────────────────────────

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[68ch]">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Estado vacío ─────────────────────────────────────────────────────────────

/**
 * Explica qué es la sección y ofrece el paso siguiente.
 * Nunca un «aquí no hay nada» a secas.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ── Esqueletos de carga ──────────────────────────────────────────────────────

/** Bloque con la forma del contenido que va a llegar. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton rounded', className)} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" role="status" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="hidden h-3.5 w-20 sm:block" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

// ── Botones ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface hover:bg-surface-sunken',
  ghost: 'text-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'border border-line-strong bg-surface text-danger hover:bg-danger-soft',
};

export const buttonClass = (variant: ButtonVariant = 'secondary', extra?: string) =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2',
    'text-sm font-medium transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
    BUTTON_CLASSES[variant],
    extra,
  );

// ── Aviso en línea ───────────────────────────────────────────────────────────

/**
 * Mensaje contextual. Usa borde completo y fondo tenue,
 * nunca una franja lateral de color.
 */
export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
}) {
  const border: Record<Tone, string> = {
    neutral: 'border-line',
    accent: 'border-accent/30',
    success: 'border-success/30',
    warning: 'border-warning/35',
    danger: 'border-danger/35',
    info: 'border-info/30',
  };

  return (
    <div className={cx('rounded-lg border px-4 py-3', border[tone], TONE_CLASSES[tone])}>
      <p className="text-sm font-semibold">{title}</p>
      {children && <div className="mt-1 text-xs leading-relaxed opacity-90">{children}</div>}
    </div>
  );
}
