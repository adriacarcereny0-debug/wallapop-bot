import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, safeEqual } from './crypto';

const SECRET = 'clave-de-prueba-muy-larga-para-el-test';

describe('cifrado de tokens', () => {
  it('descifra lo que cifra', () => {
    const token = 'refresh-token-de-wallapop-123';
    expect(decryptToken(encryptToken(token, SECRET), SECRET)).toBe(token);
  });

  it('produce un texto cifrado distinto cada vez (IV aleatorio)', () => {
    const token = 'mismo-token';
    expect(encryptToken(token, SECRET)).not.toBe(encryptToken(token, SECRET));
  });

  it('nunca deja el token en claro dentro del texto cifrado', () => {
    const token = 'secreto-visible';
    expect(encryptToken(token, SECRET)).not.toContain(token);
  });

  it('falla con una clave incorrecta en lugar de devolver basura', () => {
    const encrypted = encryptToken('token', SECRET);
    expect(() => decryptToken(encrypted, 'otra-clave')).toThrow();
  });

  it('detecta manipulación del texto cifrado (GCM autentica)', () => {
    const encrypted = encryptToken('token', SECRET);
    const parts = encrypted.split(':');
    const tampered = `${parts[0]}:${parts[1]}:${Buffer.from('falso').toString('base64url')}`;
    expect(() => decryptToken(tampered, SECRET)).toThrow();
  });
});

describe('safeEqual', () => {
  it('compara correctamente', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
