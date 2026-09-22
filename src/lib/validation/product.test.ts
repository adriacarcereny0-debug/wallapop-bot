import { describe, expect, it } from 'vitest';
import { newProductSchema, parseFeatures } from './product';

const base = {
  name: 'iPhone 15 Pro',
  brand: '',
  model: '',
  category: 'Móviles',
  subcategory: '',
  condition: 'very_good' as const,
  purchasePrice: '',
  targetPrice: '660',
  minPrice: '600',
  internalDescription: '',
  publicDescription: '',
  sku: 'SKU-1',
  stock: '1',
  internalNotes: '',
  features: '',
};

describe('newProductSchema', () => {
  it('acepta un producto válido y convierte los precios a céntimos', () => {
    const result = newProductSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetPrice).toBe(66_000);
      expect(result.data.minPrice).toBe(60_000);
      expect(result.data.brand).toBeNull();
    }
  });

  it('acepta importes con coma y con símbolo de euro', () => {
    const result = newProductSchema.safeParse({ ...base, targetPrice: '660,50 €' });
    expect(result.success && result.data.targetPrice).toBe(66_050);
  });

  it('rechaza un importe con formato inválido', () => {
    expect(newProductSchema.safeParse({ ...base, targetPrice: 'barato' }).success).toBe(false);
  });

  it('rechaza un mínimo mayor que el objetivo', () => {
    const result = newProductSchema.safeParse({ ...base, minPrice: '700', targetPrice: '600' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('minPrice'))).toBe(true);
    }
  });

  it('exige nombre, categoría y SKU', () => {
    expect(newProductSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
    expect(newProductSchema.safeParse({ ...base, category: '' }).success).toBe(false);
    expect(newProductSchema.safeParse({ ...base, sku: '' }).success).toBe(false);
  });
});

describe('parseFeatures', () => {
  it('convierte líneas «Clave: valor» en un objeto', () => {
    expect(parseFeatures('Batería: 91 %\nColor: Titanio')).toEqual({
      'Batería': '91 %',
      Color: 'Titanio',
    });
  });

  it('ignora líneas sin separador o incompletas', () => {
    expect(parseFeatures('sin separador\nClave:\n: sin clave\nOK: sí')).toEqual({ OK: 'sí' });
  });

  it('conserva los dos puntos que aparezcan en el valor', () => {
    expect(parseFeatures('Horario: 9:00 a 18:00')).toEqual({ Horario: '9:00 a 18:00' });
  });
});
