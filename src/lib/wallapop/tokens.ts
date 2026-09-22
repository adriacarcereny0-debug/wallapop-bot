import { getEnv } from '@/lib/config/env';
import type { Repository } from '@/lib/data/repository';
import { decryptToken, encryptToken } from './crypto';
import { refreshTokens } from './oauth';

/**
 * Obtiene un access token válido para una cuenta, renovándolo si hace falta.
 *
 * Detalle importante del contrato de Wallapop: la renovación **rota también el
 * refresh token**. Hay que guardar el nuevo y descartar el anterior, o la
 * siguiente renovación fallará. Por eso esto vive en un solo sitio.
 */
export class TokenError extends Error {
  constructor(
    message: string,
    readonly needsReconnect: boolean,
  ) {
    super(message);
    this.name = 'TokenError';
  }
}

/** Margen de seguridad: se renueva antes de que caduque de verdad. */
const REFRESH_MARGIN_MS = 60_000;

export async function getValidAccessToken(
  repo: Repository,
  userId: string,
  accountId: string,
): Promise<string> {
  const env = getEnv();
  const stored = await repo.getAccountTokens(userId, accountId);

  if (!stored) {
    throw new TokenError(
      'Esta cuenta no está conectada con Wallapop. Conéctala desde la sección «Cuentas».',
      true,
    );
  }

  const secret = env.TOKEN_ENCRYPTION_KEY;
  const expiresAt = Date.parse(stored.expiresAt);

  // Token todavía válido: se usa tal cual.
  if (Number.isFinite(expiresAt) && expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return decryptToken(stored.accessTokenEncrypted, secret);
  }

  // Caducado o a punto: se renueva.
  let refreshed;
  try {
    refreshed = await refreshTokens({
      refreshToken: decryptToken(stored.refreshTokenEncrypted, secret),
      clientId: env.WALLAPOP_CLIENT_ID!,
      clientSecret: env.WALLAPOP_CLIENT_SECRET!,
    });
  } catch (cause) {
    await repo.flagAccount(
      userId,
      accountId,
      'La autorización con Wallapop ha caducado. Vuelve a conectar la cuenta.',
    );
    throw new TokenError(
      `No se pudo renovar la autorización de Wallapop: ${(cause as Error).message}. ` +
        'Vuelve a conectar la cuenta.',
      true,
    );
  }

  await repo.saveAccountTokens(userId, accountId, {
    accessTokenEncrypted: encryptToken(refreshed.accessToken, secret),
    refreshTokenEncrypted: encryptToken(refreshed.refreshToken, secret),
    expiresAt: refreshed.expiresAt,
  });

  return refreshed.accessToken;
}
