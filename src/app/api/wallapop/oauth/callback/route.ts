import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getEnv } from '@/lib/config/env';
import { requireSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { encryptToken, safeEqual } from '@/lib/wallapop/crypto';
import { exchangeCode, OAUTH_COOKIE } from '@/lib/wallapop/oauth';

/**
 * Recibe la vuelta de Wallapop y canjea el código por tokens.
 *
 * Los tokens se cifran (AES-256-GCM) antes de tocar la base de datos. En texto
 * plano darían acceso completo a la cuenta del vendedor.
 */
function back(message: string, ok = false): NextResponse {
  const url = new URL(
    `/cuentas?${ok ? 'conectada' : 'error'}=${encodeURIComponent(message)}`,
    getEnv().NEXT_PUBLIC_APP_URL,
  );
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const store = await cookies();
  const raw = store.get(OAUTH_COOKIE)?.value;
  store.delete(OAUTH_COOKIE);

  try {
    const session = await requireSession();
    const params = new URL(request.url).searchParams;

    const denied = params.get('error');
    if (denied) return back('Has cancelado la autorización en Wallapop.');

    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return back('Wallapop no devolvió un código válido.');

    if (!raw) return back('La autorización ha caducado. Vuelve a intentarlo.');

    const pending = JSON.parse(raw) as {
      verifier: string;
      state: string;
      accountId: string;
    };

    // Comprobación CSRF en tiempo constante.
    if (!safeEqual(pending.state, state)) {
      return back('La autorización no se pudo verificar. Vuelve a intentarlo.');
    }

    const repo = await getRepository();
    const account = await repo.getAccount(session.userId, pending.accountId);
    if (!account) return back('La cuenta ya no existe.');

    const env = getEnv();
    const tokens = await exchangeCode({
      code,
      verifier: pending.verifier,
      clientId: env.WALLAPOP_CLIENT_ID!,
      clientSecret: env.WALLAPOP_CLIENT_SECRET!,
      redirectUri: env.WALLAPOP_REDIRECT_URI!,
    });

    const secret = env.TOKEN_ENCRYPTION_KEY;
    await repo.saveAccountTokens(session.userId, pending.accountId, {
      accessTokenEncrypted: encryptToken(tokens.accessToken, secret),
      refreshTokenEncrypted: encryptToken(tokens.refreshToken, secret),
      expiresAt: tokens.expiresAt,
    });

    await repo.logActivity(session.userId, {
      accountId: pending.accountId,
      kind: 'account_attention',
      message: `Cuenta «${account.name}» conectada con Wallapop`,
    });

    return back(`La cuenta «${account.name}» se ha conectado correctamente.`, true);
  } catch (error) {
    console.error('Fallo en el callback de OAuth:', error);
    return back('No se pudo completar la conexión con Wallapop. Inténtalo de nuevo.');
  }
}
