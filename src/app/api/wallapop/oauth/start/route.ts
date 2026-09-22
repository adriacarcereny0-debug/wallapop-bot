import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getEnv, isWallapopConfigured } from '@/lib/config/env';
import { requireSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import {
  buildAuthorizationUrl,
  createPkcePair,
  createState,
  OAUTH_COOKIE,
} from '@/lib/wallapop/oauth';
import { errorResponse } from '@/lib/http/responses';

/**
 * Arranca la autorización OAuth de una cuenta de Wallapop.
 *
 * El verificador PKCE y el `state` se guardan en una cookie httpOnly de vida
 * corta: nunca viajan al JavaScript del navegador y caducan solos si el usuario
 * abandona el flujo a medias.
 */

export async function GET(request: Request) {
  try {
    const session = await requireSession();

    if (!isWallapopConfigured()) {
      return NextResponse.json(
        {
          error:
            'No hay credenciales de aplicación integradora de Wallapop configuradas en el servidor.',
        },
        { status: 409 },
      );
    }

    const accountId = new URL(request.url).searchParams.get('cuenta');
    if (!accountId) {
      return NextResponse.json({ error: 'Falta el identificador de cuenta.' }, { status: 400 });
    }

    // La cuenta debe ser del usuario autenticado.
    const repo = await getRepository();
    const account = await repo.getAccount(session.userId, accountId);
    if (!account) {
      return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 });
    }

    const env = getEnv();
    const { verifier, challenge } = createPkcePair();
    const state = createState();

    const store = await cookies();
    store.set(OAUTH_COOKIE, JSON.stringify({ verifier, state, accountId }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutos: lo justo para completar la autorización.
    });

    return NextResponse.redirect(
      buildAuthorizationUrl({
        clientId: env.WALLAPOP_CLIENT_ID!,
        redirectUri: env.WALLAPOP_REDIRECT_URI!,
        challenge,
        state,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
