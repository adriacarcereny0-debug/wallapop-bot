'use client';

import { useState } from 'react';
import { Notice, Surface, buttonClass, cx } from '@/components/ui/primitives';
import type { Optimization } from '@/lib/ai/types';

/**
 * Optimizador de anuncios.
 *
 * La puntuación mide la CALIDAD del anuncio: claridad, completitud y estructura.
 * La interfaz lo dice explícitamente, porque no es —y no puede ser— una
 * predicción de visitas ni de ventas.
 */
export function ListingOptimizer(props: {
  title: string;
  description: string;
  priceCents: number;
  category: string;
  photoCount: number;
  features: Record<string, string>;
}) {
  const [result, setResult] = useState<Optimization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(props),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo analizar el anuncio');

      setResult(payload.optimization);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Surface as="section" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            Optimizar anuncio
          </h2>
          <p className="mt-1 max-w-[62ch] text-xs leading-relaxed text-muted">
            Analiza la calidad del anuncio y propone mejoras concretas.
          </p>
        </div>
        <button
          type="button"
          onClick={analyze}
          disabled={loading}
          className={buttonClass(result ? 'secondary' : 'primary', 'shrink-0')}
        >
          {loading ? 'Analizando…' : result ? 'Volver a analizar' : 'Analizar'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5 flex flex-col gap-5">
          <div>
            <p className="text-2xs font-semibold tracking-wide text-muted uppercase">
              Puntos a mejorar
            </p>
            <dl className="mt-2.5 flex flex-col gap-2.5">
              <Score label="Título" value={result.scores.title} />
              <Score label="Descripción" value={result.scores.description} />
              <Score label="Fotos" value={result.scores.photos} />
              <Score label="Información" value={result.scores.information} />
            </dl>
            <p className="mt-3 text-2xs leading-relaxed text-faint">
              Esta puntuación valora la calidad del anuncio. No predice visitas ni ventas: nadie
              puede garantizarlas.
            </p>
          </div>

          {result.recommendations.length > 0 && (
            <List title="Recomendaciones" items={result.recommendations} />
          )}
          {result.missingInformation.length > 0 && (
            <List title="Información que falta" items={result.missingInformation} />
          )}
          {result.possibleErrors.length > 0 && (
            <Notice tone="warning" title="Posibles errores detectados">
              <ul className="list-disc space-y-0.5 pl-4">
                {result.possibleErrors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Notice>
          )}
        </div>
      )}
    </Surface>
  );
}

/** Barra de puntuación. El color viene del valor, no del tipo de métrica. */
function Score({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 8 ? 'bg-success' : value >= 6 ? 'bg-warning' : 'bg-danger';

  return (
    <div className="flex items-center gap-3">
      <dt className="w-24 shrink-0 text-sm">{label}</dt>
      <dd className="flex flex-1 items-center gap-2.5">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken"
          role="img"
          aria-label={`${label}: ${value} sobre 10`}
        >
          <div
            className={cx('h-full rounded-full transition-[width] duration-300', tone)}
            style={{ width: `${value * 10}%` }}
          />
        </div>
        <span className="tnum w-10 shrink-0 text-right text-xs font-medium">{value}/10</span>
      </dd>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-2xs font-semibold tracking-wide text-muted uppercase">{title}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-relaxed">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
