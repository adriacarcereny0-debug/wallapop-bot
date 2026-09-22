import { describe, expect, it } from 'vitest';
import { formatRelative, parseEurosToCents } from './index';

describe('parseEurosToCents', () => {
  it('acepta coma y punto decimal', () => {
    expect(parseEurosToCents('650,50')).toBe(65_050);
    expect(parseEurosToCents('650.50')).toBe(65_050);
  });

  it('acepta importes enteros y con símbolo', () => {
    expect(parseEurosToCents('650')).toBe(65_000);
    expect(parseEurosToCents('650 €')).toBe(65_000);
  });

  it('rechaza entradas inválidas en lugar de devolver NaN', () => {
    expect(parseEurosToCents('abc')).toBeNull();
    expect(parseEurosToCents('')).toBeNull();
    expect(parseEurosToCents('-50')).toBeNull();
    expect(parseEurosToCents('1,234')).toBeNull();
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-09-22T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('formatea minutos, horas y días', () => {
    expect(formatRelative(ago(5 * 60_000), now)).toBe('hace 5 min');
    expect(formatRelative(ago(3 * 3_600_000), now)).toBe('hace 3 h');
    expect(formatRelative(ago(2 * 86_400_000), now)).toBe('hace 2 días');
  });

  it('usa singular para un solo día', () => {
    expect(formatRelative(ago(86_400_000), now)).toBe('hace 1 día');
  });
});
