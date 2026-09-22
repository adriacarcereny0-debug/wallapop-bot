import { createHash, randomBytes } from 'node:crypto';

/**
 * OAuth 2.0 Authorization Code + PKCE contra el Keycloak de Wallapop.
 *
 * Endpoints tomados de las especificaciones oficiales (realm `wallapop-connect`).
 * Ver docs/WALLAPOP_INTEGRATION.md — y verificarlos contra el portal oficial
 * antes de usarlos en producción.
 */

export const WALLAPOP_AUTH_URL =
  'https://iam.wallapop.com/realms/wallapop-connect/protocol/openid-connect/auth';
export const WALLAPOP_TOKEN_URL =
  'https://iam.wallapop.com/realms/wallapop-connect/protocol/openid-connect/token';

/** El endpoint de token rechaza peticiones sin un User-Agent válido. */
const USER_AGENT = 'WallapopAssistant/0.1 (+https://github.com/adriacarcereny0-debug/wallapop-bot)';

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/**
 * Genera el par PKCE.
 * El verificador es una cadena URL-safe de 43 caracteres como mínimo, según exige
 * la documentación; el reto es su SHA-256 en base64url (método S256).
 */
export function createPkcePair(): PkcePair {
  const verifier = randomBytes(48).toString('base64url'); // 64 caracteres
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Valor aleatorio para el parámetro `state` (protección CSRF). */
export function createState(): string {
  return randomBytes(24).toString('base64url');
}

export function buildAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
}): string {
  const url = new URL(WALLAPOP_AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('code_challenge', params.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  return url.toString();
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Instante de caducidad del access token, en ISO 8601. */
  expiresAt: string;
}

interface RawTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function requestToken(body: URLSearchParams): Promise<TokenSet> {
  const response = await fetch(WALLAPOP_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Wallapop rechazó la petición de token (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as RawTokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

/** Canjea el código de autorización por el primer par de tokens. */
export function exchangeCode(params: {
  code: string;
  verifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenSet> {
  return requestToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.verifier,
      client_id: params.clientId,
      client_secret: params.clientSecret,
    }),
  );
}

/**
 * Renueva el access token.
 *
 * IMPORTANTE: Wallapop rota también el refresh token. Hay que guardar el nuevo
 * y descartar el anterior, o la siguiente renovación fallará.
 */
export function refreshTokens(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenSet> {
  return requestToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
    }),
  );
}
