import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MAX_SKEW_MS, verifyWebhook } from './webhooks';

const TOKEN = 'token-de-prueba';
const BODY = '{"id":"evt-1","type":"ITEM_LISTED","occurred_on":1,"data":{}}';

function sign(body: string, timestamp: string, token = TOKEN): string {
  return createHmac('sha256', token).update(`${body}:${timestamp}`).digest('hex');
}

describe('verifyWebhook', () => {
  const now = 1_700_000_000_000;
  const timestamp = String(now);

  it('acepta una entrega correctamente firmada', () => {
    const result = verifyWebhook({
      rawBody: BODY,
      signature: sign(BODY, timestamp),
      timestamp,
      token: TOKEN,
      now,
    });
    expect(result.ok).toBe(true);
  });

  it('rechaza una firma hecha con otro token', () => {
    const result = verifyWebhook({
      rawBody: BODY,
      signature: sign(BODY, timestamp, 'token-incorrecto'),
      timestamp,
      token: TOKEN,
      now,
    });
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rechaza un cuerpo manipulado', () => {
    const signature = sign(BODY, timestamp);
    const result = verifyWebhook({
      rawBody: BODY.replace('ITEM_LISTED', 'SALE_COMPLETED'),
      signature,
      timestamp,
      token: TOKEN,
      now,
    });
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rechaza una entrega fuera de la ventana de tolerancia (replay)', () => {
    const old = String(now - MAX_SKEW_MS - 1000);
    const result = verifyWebhook({
      rawBody: BODY,
      signature: sign(BODY, old),
      timestamp: old,
      token: TOKEN,
      now,
    });
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('rechaza si faltan cabeceras', () => {
    expect(
      verifyWebhook({ rawBody: BODY, signature: null, timestamp, token: TOKEN, now }),
    ).toEqual({ ok: false, reason: 'missing_headers' });
  });

  it('rechaza un timestamp no numérico', () => {
    const result = verifyWebhook({
      rawBody: BODY,
      signature: sign(BODY, 'ayer'),
      timestamp: 'ayer',
      token: TOKEN,
      now,
    });
    expect(result).toEqual({ ok: false, reason: 'bad_timestamp' });
  });
});
