import { beforeEach, describe, expect, it } from 'vitest';
import { rateLimit, resetRateLimits } from './rate-limit';

describe('rateLimit', () => {
  beforeEach(resetRateLimits);

  const options = { limit: 3, windowMs: 60_000 };

  it('permite peticiones hasta el límite', () => {
    const now = 1_000;
    expect(rateLimit('u1', options, now).ok).toBe(true);
    expect(rateLimit('u1', options, now).ok).toBe(true);
    expect(rateLimit('u1', options, now).ok).toBe(true);
  });

  it('bloquea al superar el límite e indica cuánto esperar', () => {
    const now = 1_000;
    for (let i = 0; i < 3; i++) rateLimit('u1', options, now);

    const blocked = rateLimit('u1', options, now);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it('aísla usuarios distintos', () => {
    const now = 1_000;
    for (let i = 0; i < 3; i++) rateLimit('u1', options, now);

    expect(rateLimit('u2', options, now).ok).toBe(true);
  });

  it('se reinicia al pasar la ventana', () => {
    const now = 1_000;
    for (let i = 0; i < 3; i++) rateLimit('u1', options, now);

    expect(rateLimit('u1', options, now + 60_001).ok).toBe(true);
  });
});
