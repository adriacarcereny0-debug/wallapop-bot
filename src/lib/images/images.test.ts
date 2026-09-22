import { describe, expect, it, vi } from 'vitest';
import { buildInstruction, enhanceImage } from './service';
import {
  ALLOWED_EDITS,
  ImageError,
  isEditKind,
  TRUTHFULNESS_RULES,
  type ImageBytes,
  type ImageProvider,
} from './types';
import { assertAcceptableImage, MAX_IMAGE_BYTES } from './storage';

describe('catálogo de ediciones', () => {
  it('sólo admite ediciones que no falsean el producto', () => {
    expect(Object.keys(ALLOWED_EDITS).sort()).toEqual([
      'lighting',
      'neutral_background',
      'straighten',
    ]);
  });

  it('rechaza cualquier edición fuera del catálogo', () => {
    // La interfaz no puede pedir «quita el arañazo»: no existe esa clave.
    expect(isEditKind('remove_scratches')).toBe(false);
    expect(isEditKind('add_accessories')).toBe(false);
    expect(isEditKind('neutral_background')).toBe(true);
  });
});

describe('buildInstruction', () => {
  it('añade siempre las reglas de veracidad', () => {
    for (const kind of Object.keys(ALLOWED_EDITS) as (keyof typeof ALLOWED_EDITS)[]) {
      expect(buildInstruction(kind)).toContain(TRUTHFULNESS_RULES);
    }
  });

  it('prohíbe explícitamente ocultar marcas de uso', () => {
    const instruction = buildInstruction('lighting');
    expect(instruction).toContain('No elimines ni disimules arañazos');
    expect(instruction).toContain('No añadas accesorios');
    expect(instruction).toContain('No modifiques el color real');
  });
});

describe('enhanceImage', () => {
  it('entrega al proveedor la instrucción con las reglas incluidas', async () => {
    const edit = vi.fn<ImageProvider['edit']>().mockResolvedValue({
      data: Buffer.from('editada'),
      mimeType: 'image/png',
    });
    const provider: ImageProvider = { name: 'prueba', edit };

    const original: ImageBytes = { data: Buffer.from('original'), mimeType: 'image/jpeg' };
    await enhanceImage(original, 'neutral_background', provider);

    expect(edit).toHaveBeenCalledOnce();
    expect(edit.mock.calls[0]![0].instruction).toContain(TRUTHFULNESS_RULES);
    expect(edit.mock.calls[0]![0].image).toBe(original);
  });
});

describe('assertAcceptableImage', () => {
  it('acepta los formatos habituales', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(() => assertAcceptableImage({ type, size: 1000 })).not.toThrow();
    }
  });

  it('rechaza formatos no admitidos', () => {
    expect(() => assertAcceptableImage({ type: 'application/pdf', size: 1000 })).toThrow(
      ImageError,
    );
  });

  it('rechaza ficheros demasiado grandes', () => {
    expect(() =>
      assertAcceptableImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }),
    ).toThrow(/pesa demasiado/);
  });

  it('rechaza ficheros vacíos', () => {
    expect(() => assertAcceptableImage({ type: 'image/png', size: 0 })).toThrow(/vacío/);
  });
});
