import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AIError } from '@/lib/ai/types';
import { UnauthorizedError } from '@/lib/auth/session';
import { IntegrationDisabledError, WallapopError } from '@/lib/wallapop/client';

/**
 * Traduce un error a una respuesta HTTP.
 *
 * Nunca se filtran trazas ni detalles internos al cliente: el mensaje que ve el
 * usuario es comprensible, y el detalle técnico se queda en el registro.
 */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Los datos enviados no son válidos.',
        fields: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  if (error instanceof AIError) {
    const status = error.reason === 'budget' ? 429 : error.reason === 'config' ? 500 : 502;
    return NextResponse.json({ error: error.message }, { status });
  }

  if (error instanceof IntegrationDisabledError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof WallapopError) {
    console.error('Error de Wallapop:', error.status, error.detail);
    return NextResponse.json(
      { error: 'Wallapop ha rechazado la operación. Inténtalo de nuevo más tarde.' },
      { status: 502 },
    );
  }

  console.error('Error no controlado:', error);
  return NextResponse.json(
    { error: 'Se ha producido un error inesperado. Inténtalo de nuevo.' },
    { status: 500 },
  );
}

export function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: `Has hecho demasiadas peticiones. Espera ${retryAfterSeconds} segundos.`,
    },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}
