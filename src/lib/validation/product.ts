import { z } from 'zod';

/**
 * Validación del formulario de producto.
 *
 * Se valida en el servidor, no sólo en el navegador: la validación del cliente
 * es comodidad, no seguridad.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();

/** Importe escrito por una persona («650», «650,50», «650 €») a céntimos. */
const optionalPrice = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    if (!raw) return null;

    const normalized = raw.replace(/\s|€/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      ctx.addIssue({ code: 'custom', message: 'Importe no válido. Ejemplo: 650 o 650,50' });
      return null;
    }
    return Math.round(parseFloat(normalized) * 100);
  })
  .nullable();

export const newProductSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
    brand: optionalText(100),
    model: optionalText(100),
    category: z.string().trim().min(1, 'La categoría es obligatoria').max(100),
    subcategory: optionalText(100),
    condition: z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable', 'for_parts']),
    purchasePrice: optionalPrice,
    targetPrice: optionalPrice,
    minPrice: optionalPrice,
    internalDescription: optionalText(2000),
    publicDescription: optionalText(4000),
    sku: z.string().trim().min(1, 'El SKU es obligatorio').max(60),
    stock: z.coerce.number().int().min(0).max(10_000),
    internalNotes: optionalText(2000),
    /** Características, una por línea, con el formato «Clave: valor». */
    features: z.string().max(4000).default(''),
  })
  .superRefine((data, ctx) => {
    // Un mínimo por encima del objetivo haría inútil el asistente de negociación.
    if (data.minPrice !== null && data.targetPrice !== null && data.minPrice > data.targetPrice) {
      ctx.addIssue({
        code: 'custom',
        path: ['minPrice'],
        message: 'El precio mínimo no puede ser mayor que el objetivo.',
      });
    }
  });

export type NewProductForm = z.infer<typeof newProductSchema>;

/** Convierte el bloque de texto de características en un objeto. */
export function parseFeatures(raw: string): Record<string, string> {
  const features: Record<string, string> = {};

  for (const line of raw.split('\n')) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && value) features[key] = value;
  }

  return features;
}
