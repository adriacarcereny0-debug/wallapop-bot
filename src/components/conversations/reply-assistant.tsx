'use client';

import { useState } from 'react';
import { Notice, Pill, buttonClass } from '@/components/ui/primitives';
import { formatCurrency } from '@/lib/format';
import type { NegotiationAdvice, ReplyDraft } from '@/lib/ai/types';

/**
 * Asistente de respuesta y negociación.
 *
 * Flujo obligatorio: la IA genera → el usuario edita → el usuario copia → el
 * usuario envía desde Wallapop. **No hay botón de enviar**, porque no existe
 * ninguna vía autorizada para enviar mensajes por programa.
 */
export function ReplyAssistant(props: {
  conversationId: string;
  lastMessage: string;
  listingTitle: string;
  priceCents: number;
  targetPriceCents: number | null;
  minPriceCents: number | null;
  features: Record<string, string>;
}) {
  const [draft, setDraft] = useState<ReplyDraft | null>(null);
  const [body, setBody] = useState('');
  const [negotiation, setNegotiation] = useState<NegotiationAdvice | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setState('loading');
    setError(null);

    try {
      const response = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: props.conversationId,
          lastMessage: props.lastMessage,
          listingTitle: props.listingTitle,
          priceCents: props.priceCents,
          targetPriceCents: props.targetPriceCents,
          minPriceCents: props.minPriceCents,
          features: props.features,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo generar la respuesta');

      setDraft(payload.reply);
      setBody(payload.reply.body);
      setNegotiation(payload.negotiation ?? null);
      setState('idle');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error desconocido');
      setState('error');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('El navegador ha bloqueado el portapapeles. Copia el texto manualmente.');
    }
  }

  if (!draft) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={state === 'loading'}
          className={buttonClass('primary')}
        >
          {state === 'loading' ? 'Generando…' : 'Generar respuesta con IA'}
        </button>
        <p className="text-xs text-muted">Revisarás el borrador antes de usarlo.</p>
        {error && (
          <p role="alert" className="w-full text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {negotiation && <NegotiationPanel advice={negotiation} />}

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor={`reply-${props.conversationId}`} className="text-xs font-semibold">
            Borrador de respuesta
          </label>
          <Pill tone="accent">Generado por IA · sin enviar</Pill>
        </div>

        <textarea
          id={`reply-${props.conversationId}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          className="w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-sm leading-relaxed"
        />

        {draft.cannotAnswer.length > 0 && (
          <div className="mt-2">
            <Notice tone="warning" title="Revisa esto antes de enviar">
              <ul className="list-disc space-y-0.5 pl-4">
                {draft.cannotAnswer.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Notice>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={copy} className={buttonClass('primary')}>
            {copied ? 'Copiado' : 'Copiar respuesta'}
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={state === 'loading'}
            className={buttonClass('secondary')}
          >
            {state === 'loading' ? 'Regenerando…' : 'Regenerar'}
          </button>
          <p className="text-2xs text-faint">
            Pega el texto en Wallapop para enviarlo. La aplicación no puede enviarlo por ti.
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** Opciones de negociación. Ninguna se ejecuta sola: sólo informan la decisión. */
function NegotiationPanel({ advice }: { advice: NegotiationAdvice }) {
  return (
    <section className="rounded-lg border border-line bg-surface-sunken px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
          Asistente de negociación
        </h3>
        <p className="tnum text-sm">
          Oferta recibida:{' '}
          <strong className={advice.belowMinimum ? 'text-danger' : 'text-success'}>
            {formatCurrency(advice.offerCents)}
          </strong>
        </p>
      </div>

      <p className="mt-2 text-sm leading-relaxed">{advice.recommendation}</p>

      <ul className="mt-3 flex flex-col gap-1.5">
        {advice.options.map((option, index) => (
          <li
            key={`${option.action}-${index}`}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-surface px-3 py-2"
          >
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-2xs text-muted">{option.rationale}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-2xs text-faint">
        Estas opciones son orientativas. Aceptar o rechazar una oferta se hace en Wallapop.
      </p>
    </section>
  );
}
