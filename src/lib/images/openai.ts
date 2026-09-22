import { ImageError, type ImageBytes, type ImageProvider } from './types';

/**
 * Edición de imágenes con OpenAI.
 *
 * Alternativa a Gemini. No tiene nivel gratuito, así que sólo compensa si ya se
 * paga OpenAI por otro motivo.
 */
export class OpenAIImageProvider implements ImageProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async edit({ image, instruction }: { image: ImageBytes; instruction: string }): Promise<ImageBytes> {
    const form = new FormData();
    form.append('model', this.model);
    form.append('prompt', instruction);
    form.append(
      'image',
      new Blob([new Uint8Array(image.data)], { type: image.mimeType }),
      'origen.png',
    );

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
    } catch (cause) {
      throw new ImageError(
        `No se pudo contactar con el proveedor de imágenes: ${(cause as Error).message}`,
        'provider',
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new ImageError('La clave de la API de imágenes no es válida.', 'config');
      }
      if (response.status === 429) {
        throw new ImageError(
          'Has alcanzado el límite de peticiones del proveedor de imágenes.',
          'provider',
        );
      }
      throw new ImageError(
        `El proveedor de imágenes devolvió un error ${response.status}.`,
        'provider',
      );
    }

    const payload = (await response.json()) as { data?: { b64_json?: string }[] };
    const b64 = payload.data?.[0]?.b64_json;

    if (!b64) throw new ImageError('El proveedor no devolvió ninguna imagen.', 'provider');

    return { data: Buffer.from(b64, 'base64'), mimeType: 'image/png' };
  }
}
