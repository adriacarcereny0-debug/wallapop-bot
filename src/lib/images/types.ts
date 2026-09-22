/** Imagen en memoria, tal y como viaja entre el proveedor y el almacenamiento. */
export interface ImageBytes {
  data: Buffer;
  mimeType: string;
}

/** Transformaciones permitidas sobre la foto de un producto de segunda mano. */
export const ALLOWED_EDITS = {
  neutral_background: {
    label: 'Fondo neutro',
    description: 'Sustituye el fondo por uno liso y claro, sin tocar el producto.',
    instruction:
      'Sustituye ÚNICAMENTE el fondo por un gris muy claro y uniforme, de estudio. ' +
      'No modifiques el producto en absoluto.',
  },
  lighting: {
    label: 'Mejorar iluminación',
    description: 'Corrige exposición y sombras duras. No altera el producto.',
    instruction:
      'Corrige la exposición y el balance de blancos, y suaviza las sombras duras. ' +
      'No alteres el color real del producto ni ocultes ninguna marca de uso.',
  },
  straighten: {
    label: 'Enderezar y encuadrar',
    description: 'Corrige la perspectiva y centra el producto.',
    instruction:
      'Endereza la perspectiva y centra el producto en el encuadre, manteniendo ' +
      'sus proporciones reales. No recortes ninguna parte del producto.',
  },
} as const;

export type EditKind = keyof typeof ALLOWED_EDITS;

export function isEditKind(value: string): value is EditKind {
  return value in ALLOWED_EDITS;
}

/**
 * Reglas de veracidad que acompañan a TODA edición.
 *
 * Son el motivo por el que esta funcionalidad es defendible: una foto retocada
 * que oculte un golpe convierte una venta legítima en un engaño al comprador.
 */
export const TRUTHFULNESS_RULES = [
  'No elimines ni disimules arañazos, golpes, desgaste ni ninguna marca de uso.',
  'No añadas accesorios, cajas ni elementos que no aparezcan en la foto original.',
  'No modifiques el color real del producto.',
  'No cambies el modelo, la forma ni el número de unidades.',
  'El producto debe seguir siendo exactamente el mismo y reconocible.',
].join(' ');

export class ImageError extends Error {
  constructor(
    message: string,
    readonly reason: 'config' | 'provider' | 'input',
  ) {
    super(message);
    this.name = 'ImageError';
  }
}

/** Contrato de un proveedor de edición de imágenes. */
export interface ImageProvider {
  readonly name: string;
  /** Aplica una edición permitida a una imagen existente. */
  edit(input: { image: ImageBytes; instruction: string }): Promise<ImageBytes>;
}
