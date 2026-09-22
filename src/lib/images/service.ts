import { getEnv } from '@/lib/config/env';
import { GeminiImageProvider } from './gemini';
import { OpenAIImageProvider } from './openai';
import {
  ALLOWED_EDITS,
  ImageError,
  TRUTHFULNESS_RULES,
  type EditKind,
  type ImageBytes,
  type ImageProvider,
} from './types';

/**
 * Servicio de imágenes.
 *
 * Único sitio desde el que se edita una foto. Su cometido principal no es
 * llamar al proveedor, sino **garantizar que la instrucción que llega al modelo
 * lleva siempre las reglas de veracidad**: el catálogo de ediciones es cerrado,
 * así que no hay forma de pedir «quita el arañazo» desde la interfaz.
 */
export function createImageProvider(): ImageProvider {
  const env = getEnv();

  switch (env.IMAGE_PROVIDER) {
    case 'gemini':
      return new GeminiImageProvider(env.GEMINI_API_KEY!, env.GEMINI_IMAGE_MODEL);
    case 'openai':
      return new OpenAIImageProvider(env.OPENAI_API_KEY!, env.OPENAI_IMAGE_MODEL);
    default:
      throw new ImageError(
        'No hay proveedor de mejora de imágenes configurado. Define IMAGE_PROVIDER.',
        'config',
      );
  }
}

/**
 * Construye la instrucción final: la edición pedida más las reglas innegociables.
 * Exportada para poder verificarla en los tests.
 */
export function buildInstruction(kind: EditKind): string {
  const edit = ALLOWED_EDITS[kind];
  return (
    `Edita esta fotografía de un producto de segunda mano. ${edit.instruction}\n\n` +
    `REGLAS OBLIGATORIAS QUE NO PUEDES INCUMPLIR: ${TRUTHFULNESS_RULES}\n\n` +
    'Devuelve únicamente la imagen editada.'
  );
}

export async function enhanceImage(
  image: ImageBytes,
  kind: EditKind,
  provider: ImageProvider = createImageProvider(),
): Promise<ImageBytes> {
  return provider.edit({ image, instruction: buildInstruction(kind) });
}
