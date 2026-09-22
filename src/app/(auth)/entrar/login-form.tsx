'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Notice, buttonClass } from '@/components/ui/primitives';
import { login } from './actions';
import { EMPTY_FORM_STATE, type FormState } from '@/lib/forms/state';

const INITIAL: FormState = EMPTY_FORM_STATE;

export function LoginForm() {
  const [state, action] = useActionState(login, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-3.5">
      {state.error && <Notice tone="danger" title={state.error} />}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Correo electrónico</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Contraseña</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm"
        />
      </label>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass('primary', 'mt-1 w-full')}>
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  );
}
