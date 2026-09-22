'use client';

import { useState } from 'react';
import { Notice, Pill, Surface, buttonClass } from '@/components/ui/primitives';
import { formatCurrency, parseEurosToCents } from '@/lib/format';
import type { GeneratedListing } from '@/lib/ai/types';

interface AccountOption {
  id: string;
  name: string;
}

/**
 * Generador de anuncios con pantalla de revisión.
 *
 * El flujo es innegociable: introducir datos → generar → **revisar** → aprobar.
 * Nada llega a publicarse sin que una persona pulse «Aprobar», y la procedencia
 * de cada dato se muestra en la propia pantalla de revisión.
 */
export function ListingGenerator({ accounts }: { accounts: AccountOption[] }) {
  const [form, setForm] = useState({
    name: '',
    brand: '',
    category: 'Electrónica',
    condition: 'Muy bueno',
    price: '',
    features: '',
    notes: '',
    accountId: accounts[0]?.id ?? '',
  });

  const [result, setResult] = useState<GeneratedListing | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'approved'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Campos editables tras la generación: el usuario manda sobre la IA.
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** Las características se escriben una por línea como `Clave: valor`. */
  function parseFeatures(): Record<string, string> {
    const entries: Record<string, string> = {};
    for (const line of form.features.split('\n')) {
      const [key, ...rest] = line.split(':');
      if (key?.trim() && rest.length > 0) entries[key.trim()] = rest.join(':').trim();
    }
    return entries;
  }

  async function generate() {
    const priceCents = parseEurosToCents(form.price);
    if (!form.name.trim()) return setError('Indica el nombre del producto.');
    if (priceCents === null) return setError('El precio no es válido. Ejemplo: 650 o 650,50.');

    setState('loading');
    setError(null);

    try {
      const response = await fetch('/api/ai/listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: form.accountId || null,
          product: {
            name: form.name,
            brand: form.brand || null,
            model: null,
            category: form.category,
            condition: form.condition,
            priceCents,
            features: parseFeatures(),
            notes: form.notes || null,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo generar el anuncio');

      setResult(payload.listing);
      setTitle(payload.listing.title);
      setDescription(payload.listing.description);
      setState('idle');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error desconocido');
      setState('idle');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start [&>*]:min-w-0">
      {/* ── Entrada ───────────────────────────────────────────────────────── */}
      <Surface as="section" className="p-5">
        <h2 className="text-sm font-semibold">Datos del producto</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          La IA sólo usará lo que escribas aquí. Lo que dejes en blanco lo señalará como
          información que falta, en lugar de inventarlo.
        </p>

        <div className="mt-4 flex flex-col gap-3.5">
          <Field label="Producto" required>
            <input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="iPhone 15 Pro 256 GB"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Marca">
              <input
                value={form.brand}
                onChange={(e) => update('brand', e.target.value)}
                placeholder="Apple"
                className={inputClass}
              />
            </Field>
            <Field label="Precio" required>
              <input
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="650"
                inputMode="decimal"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <input
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Estado">
              <select
                value={form.condition}
                onChange={(e) => update('condition', e.target.value)}
                className={inputClass}
              >
                {['Nuevo', 'Como nuevo', 'Muy bueno', 'Bueno', 'Aceptable', 'Para piezas'].map(
                  (option) => (
                    <option key={option}>{option}</option>
                  ),
                )}
              </select>
            </Field>
          </div>

          {accounts.length > 0 && (
            <Field label="Cuenta de destino">
              <select
                value={form.accountId}
                onChange={(e) => update('accountId', e.target.value)}
                className={inputClass}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Características" hint="Una por línea, con el formato «Clave: valor»">
            <textarea
              value={form.features}
              onChange={(e) => update('features', e.target.value)}
              rows={4}
              placeholder={'Batería: 91 %\nAccesorios: Caja + cable'}
              className={inputClass}
            />
          </Field>

          <Field label="Notas" hint="Detalles que deba conocer el comprador (marcas, uso)">
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
              className={inputClass}
            />
          </Field>

          <button
            type="button"
            onClick={generate}
            disabled={state === 'loading'}
            className={buttonClass('primary', 'mt-1')}
          >
            {state === 'loading' ? 'Generando…' : 'Generar anuncio'}
          </button>

          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      </Surface>

      {/* ── Revisión ──────────────────────────────────────────────────────── */}
      {result ? (
        <Surface as="section" className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Revisión antes de usar</h2>
            <Pill tone={state === 'approved' ? 'success' : 'accent'}>
              {state === 'approved' ? 'Aprobado' : 'Generado por IA · sin aprobar'}
            </Pill>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <Field label="Título">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Descripción">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className={inputClass}
              />
            </Field>

            <Provenance result={result} />

            {result.recommendations.length > 0 && (
              <div>
                <p className="text-2xs font-semibold tracking-wide text-muted uppercase">
                  Recomendaciones
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm">
                  {result.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-md bg-surface-sunken px-3 py-2.5">
              <p className="text-2xs text-muted">Precio sugerido</p>
              <p className="tnum mt-0.5 font-semibold">
                {formatCurrency(result.suggestedPriceCents)}
              </p>
              <p className="mt-1 text-2xs leading-relaxed text-faint">{result.priceRationale}</p>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setState('approved')}
                disabled={state === 'approved'}
                className={buttonClass('primary')}
              >
                {state === 'approved' ? 'Aprobado' : 'Aprobar'}
              </button>
              <button type="button" onClick={generate} className={buttonClass('secondary')}>
                Regenerar
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(`${title}\n\n${description}`)}
                className={buttonClass('ghost')}
              >
                Copiar
              </button>
            </div>

            {state === 'approved' && (
              <Notice tone="success" title="Contenido aprobado">
                El anuncio queda listo. Publicarlo en Wallapop requiere la integración activada y
                una cuenta conectada; mientras tanto, copia el texto y publícalo desde la app.
              </Notice>
            )}
          </div>
        </Surface>
      ) : (
        <Surface as="section" className="grid min-h-64 place-items-center p-8 text-center">
          <div className="max-w-[46ch]">
            <h2 className="text-sm font-semibold">Aquí aparecerá el anuncio generado</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Antes de usarse en Wallapop, todo pasa por esta pantalla de revisión: podrás editar
              el texto, ver de dónde sale cada dato y aprobarlo o descartarlo.
            </p>
          </div>
        </Surface>
      )}
    </div>
  );
}

/**
 * Procedencia de la información.
 * Es la garantía visible de que la IA no ha inventado características.
 */
function Provenance({ result }: { result: GeneratedListing }) {
  const groups = [
    {
      key: 'provided',
      title: 'Datos que has facilitado',
      items: result.provenance.provided,
      tone: 'success' as const,
    },
    {
      key: 'inferred',
      title: 'Deducido por la IA · confírmalo',
      items: result.provenance.inferred,
      tone: 'warning' as const,
    },
    {
      key: 'missing',
      title: 'Información que falta',
      items: result.provenance.missing,
      tone: 'danger' as const,
    },
  ].filter((group) => group.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="rounded-md border border-line p-3.5">
      <p className="text-2xs font-semibold tracking-wide text-muted uppercase">
        Procedencia de la información
      </p>
      <div className="mt-2.5 flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.key}>
            <Pill tone={group.tone}>{group.title}</Pill>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-muted">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm';

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </span>
      {children}
      {hint && <span className="text-2xs text-faint">{hint}</span>}
    </label>
  );
}
