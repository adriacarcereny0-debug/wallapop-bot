import { ImageError, type ImageBytes, type ImageProvider } from './types';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { inlineData?: { mimeType: string; data: string }; text?: string }[];
    };
    finishReason?: string;
  }[];
  error?: { message: string };
}

/**
 * Edición de imágenes con Gemini («Nano Banana»).
 *
 * Se eligió por su nivel gratuito, que es el más generoso de los proveedores
 * serios y suficiente para el volumen de un vendedor. Ver docs/AI_PROVIDERS.md.
 */
export class GeminiImageProvider implements ImageProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async edit({ image, instruction }: { image: ImageBytes; instruction: string }): Promise<ImageBytes> {
    let response: Response;

    try {
      response = await fetch(`${ENDPOINT}/${this.model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: instruction },
                {
                  inlineData: {
                    mimeType: image.mimeType,
                    data: image.data.toString('base64'),
                  },
                },
              ],
            },
          ],
        }),
      });
    } catch (cause) {
      throw new ImageError(
        `No se pudo contactar con el proveedor de imágenes: ${(cause as Error).message}`,
        'provider',
      );
    }

    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as GeminiResponse | null;

      if (response.status === 429) {
        throw new ImageError(
          'Has alcanzado el límite gratuito de generación de imágenes. Inténtalo más tarde.',
          'provider',
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new ImageError('La clave de la API de imágenes no es válida.', 'config');
      }

      throw new ImageError(
        `El proveedor de imágenes devolvió un error ${response.status}: ` +
          (detail?.error?.message ?? 'sin detalle'),
        'provider',
      );
    }

    const payload = (await response.json()) as GeminiResponse;
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((part) => part.inlineData)?.inlineData;

    if (!inline) {
      // El modelo puede responder con texto si considera que no puede editar.
      const text = parts.find((part) => part.text)?.text;
      throw new ImageError(
        text
          ? `El proveedor no devolvió una imagen: ${text}`
          : 'El proveedor no devolvió ninguna imagen.',
        'provider',
      );
    }

    return {
      data: Buffer.from(inline.data, 'base64'),
      mimeType: inline.mimeType,
    };
  }
}
