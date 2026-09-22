'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Notice, Pill, Surface, buttonClass } from '@/components/ui/primitives';
import { markSold, publish, pushUpdate } from '@/app/(app)/anuncios/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms/state';

interface Props {
  listingId: string;
  /** Identificador del anuncio en Wallapop. `null` mientras no se ha publicado. */
  externalItemId: string | null;
  /** `true` si la cuenta del anuncio tiene autorización OAuth activa. */
  accountConnected: boolean;
  /** `true` si el servidor tiene credenciales de integrador. */
  integrationConfigured: boolean;
  /** Requisitos que faltan para poder publicar. */
  blockers: string[];
}

/**
 * Publicación en Wallapop.
 *
 * El botón solo se ofrece cuando la operación puede salir bien. En cualquier
 * otro caso se explica exactamente qué falta, porque un botón que falla siempre
 * es peor que un botón que no está.
 */
export function PublishPanel({
  listingId,
  externalItemId,
  accountConnected,
  integrationConfigured,
  blockers,
}: Props) {
  const published = externalItemId !== null;
  const canOperate = integrationConfigured && accountConnected && blockers.length === 0;

  return (
    <Surface as="section" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
          Publicación en Wallapop
        </h2>
        <Pill tone={published ? 'success' : 'neutral'}>
          {published ? 'Publicado' : 'Sin publicar'}
        </Pill>
      </div>

      {published && (
        <p className="mt-2.5 font-mono text-2xs break-all text-faint">ID Wallapop: {externalItemId}</p>
      )}

      {!integrationConfigured && (
        <div className="mt-3">
          <Notice tone="warning" title="Falta el alta de integrador">
            El servidor no tiene credenciales de aplicación integradora de Wallapop, así que
            ninguna operación puede salir hacia la plataforma. El anuncio se queda guardado aquí.
          </Notice>
        </div>
      )}

      {integrationConfigured && !accountConnected && (
        <div className="mt-3">
          <Notice tone="warning" title="La cuenta no está conectada">
            Conecta esta cuenta desde «Cuentas» para poder publicar en ella.
          </Notice>
        </div>
      )}

      {integrationConfigured && accountConnected && blockers.length > 0 && (
        <div className="mt-3">
          <Notice tone="warning" title="Faltan datos obligatorios">
            <ul className="list-disc space-y-0.5 pl-4">
              {blockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Notice>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {!published ? (
          <ActionForm
            listingId={listingId}
            action={publish}
            label="Publicar en Wallapop"
            pendingLabel="Publicando…"
            variant="primary"
            disabled={!canOperate}
          />
        ) : (
          <>
            <ActionForm
              listingId={listingId}
              action={pushUpdate}
              label="Enviar cambios a Wallapop"
              pendingLabel="Enviando…"
              variant="primary"
              disabled={!canOperate}
            />
            <ActionForm
              listingId={listingId}
              action={markSold}
              label="Marcar como vendido"
              pendingLabel="Marcando…"
              variant="secondary"
              disabled={!integrationConfigured || !accountConnected}
            />
          </>
        )}
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-faint">
        Publicar y despublicar requiere una suscripción Wallapop Pro activa en esa cuenta.
      </p>
    </Surface>
  );
}

type Action = typeof publish;

function ActionForm({
  listingId,
  action,
  label,
  pendingLabel,
  variant,
  disabled,
}: {
  listingId: string;
  action: Action;
  label: string;
  pendingLabel: string;
  variant: 'primary' | 'secondary';
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="listingId" value={listingId} />
      <SubmitButton
        label={label}
        pendingLabel={pendingLabel}
        variant={variant}
        disabled={disabled}
      />
      {state.error && <Notice tone="danger" title={state.error} />}
      {state.success && <Notice tone="success" title={state.success} />}
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  variant,
  disabled,
}: {
  label: string;
  pendingLabel: string;
  variant: 'primary' | 'secondary';
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={buttonClass(variant, 'w-full text-xs')}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
