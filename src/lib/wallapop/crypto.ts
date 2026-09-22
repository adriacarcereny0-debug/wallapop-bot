import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Cifrado de los tokens OAuth de Wallapop antes de guardarlos.
 *
 * Los tokens dan acceso a la cuenta del vendedor: no pueden estar en claro en la
 * base de datos. Se usa AES-256-GCM, que además autentica el texto cifrado.
 *
 * NOTA: la contraseña de Wallapop del usuario NO se pide, NO se usa y NO se
 * guarda en ningún momento. La autorización es siempre por OAuth.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function deriveKey(secret: string): Buffer {
  // La clave de entorno es texto arbitrario; se normaliza a 32 bytes.
  return createHash('sha256').update(secret).digest();
}

/** Cifra un token. Devuelve `iv:authTag:ciphertext` en base64url. */
export function encryptToken(plaintext: string, secret: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((b) => b.toString('base64url')).join(':');
}

/** Descifra un token producido por `encryptToken`. */
export function decryptToken(payload: string, secret: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Token cifrado con formato inválido');

  const [ivPart, tagPart, dataPart] = parts as [string, string, string];
  const decipher = createDecipheriv(
    ALGORITHM,
    deriveKey(secret),
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** Comparación en tiempo constante, para firmas y tokens. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
