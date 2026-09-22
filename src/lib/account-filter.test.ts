import { describe, expect, it } from 'vitest';
import { readAccountFilter } from './account-filter';

const owned = ['acc-1', 'acc-2'];

describe('readAccountFilter', () => {
  it('devuelve "all" cuando no hay parámetro', () => {
    expect(readAccountFilter({}, owned)).toBe('all');
  });

  it('acepta una cuenta propia', () => {
    expect(readAccountFilter({ cuenta: 'acc-2' }, owned)).toBe('acc-2');
  });

  it('ignora una cuenta que no pertenece al usuario', () => {
    // Aislamiento: un ?cuenta= manipulado no puede filtrar por datos ajenos.
    expect(readAccountFilter({ cuenta: 'acc-de-otro' }, owned)).toBe('all');
  });

  it('toma el primer valor si el parámetro llega repetido', () => {
    expect(readAccountFilter({ cuenta: ['acc-1', 'acc-2'] }, owned)).toBe('acc-1');
  });

  it('cae a "all" si el usuario no tiene cuentas', () => {
    expect(readAccountFilter({ cuenta: 'acc-1' }, [])).toBe('all');
  });
});
