import { randomUUID } from 'node:crypto';
import { getEnv } from '@/lib/config/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ImageError, type ImageBytes } from './types';

/**
 * Almacenamiento de imágenes en Supabase Storage.
 *
 * Las imágenes NUNCA se guardan en la base de datos: en las tablas sólo viaja
 * la URL. La ruta empieza por el `user_id`, que es lo que permite aislar los
 * ficheros de cada usuario con una política de Storage.
 */

/** Formatos aceptados. Se valida el contenido, no la extensión del nombre. */
const ACCEPTED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

/** 8 MB: por encima de eso conviene que el usuario reduzca la foto. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function assertAcceptableImage(file: { type: string; size: number }): void {
  if (!ACCEPTED.has(file.type)) {
    throw new ImageError(
      `Formato no admitido (${file.type || 'desconocido'}). Usa JPG, PNG o WebP.`,
      'input',
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageError(
      `La imagen pesa demasiado (máximo ${MAX_IMAGE_BYTES / 1024 / 1024} MB).`,
      'input',
    );
  }
  if (file.size === 0) {
    throw new ImageError('El fichero está vacío.', 'input');
  }
}

/**
 * Sube una imagen y devuelve su URL pública.
 *
 * El bucket es público en lectura porque Wallapop debe poder descargar la foto
 * al publicar el anuncio: `POST /items` recibe una URL, no los bytes. Las rutas
 * llevan un UUID, así que no son adivinables.
 */
export async function uploadImage(
  userId: string,
  productId: string,
  image: ImageBytes,
): Promise<string> {
  const env = getEnv();
  const extension = ACCEPTED.get(image.mimeType) ?? 'png';
  const path = `${userId}/${productId}/${randomUUID()}.${extension}`;

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(path, image.data, { contentType: image.mimeType, upsert: false });

  if (error) {
    throw new ImageError(`No se pudo guardar la imagen: ${error.message}`, 'provider');
  }

  const { data } = supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Descarga una imagen ya almacenada, para poder editarla. */
export async function downloadImage(url: string): Promise<ImageBytes> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new ImageError('No se pudo leer la imagen original.', 'provider');
  }

  const mimeType = response.headers.get('content-type') ?? 'image/jpeg';
  const data = Buffer.from(await response.arrayBuffer());

  return { data, mimeType };
}
