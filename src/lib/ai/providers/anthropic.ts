import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { AIProvider, CompletionRequest } from '../provider';
import { AIError, type AIResult } from '../types';

/**
 * Precios por millón de tokens, en **céntimos de dólar**.
 * Fuente: tarifa pública de la API de Anthropic. Actualizar si cambia.
 */
const PRICING_CENTS_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 500, output: 2500 },
  'claude-sonnet-5': { input: 200, output: 1000 },
  'claude-haiku-4-5': { input: 100, output: 500 },
};

/** Si el modelo no está en la tabla, se estima por lo alto para no infravalorar el gasto. */
const FALLBACK_PRICING = { input: 500, output: 2500 };

/**
 * Modelos que aceptan `thinking: adaptive` y `output_config.effort`.
 * Haiku 4.5 no los admite: enviarlos devuelve un 400.
 */
function supportsAdaptiveThinking(model: string): boolean {
  return /^claude-(opus|sonnet|fable|mythos)-/.test(model);
}

/**
 * Proveedor Anthropic.
 *
 * Fuerza salida JSON mediante `tools` + `tool_choice`, que es más fiable que
 * pedir JSON en el prompt: el modelo no puede devolver prosa alrededor.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async complete<T>(request: CompletionRequest<T>): Promise<AIResult<T>> {
    const jsonSchema = z.toJSONSchema(request.schema as z.ZodType, { io: 'output' });

    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens ?? 4000,
        system: request.system,
        messages: [{ role: 'user', content: request.prompt }],
        tools: [
          {
            name: 'responder',
            description: 'Devuelve la respuesta estructurada solicitada.',
            input_schema: jsonSchema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'responder' },
        // El esfuerzo bajo basta para redactar un anuncio y recorta el gasto de
        // forma apreciable. Se deja el pensamiento activo: desactivarlo en la
        // familia Opus puede hacer que el modelo escriba la llamada a la
        // herramienta como texto en vez de emitir el bloque `tool_use`.
        ...(supportsAdaptiveThinking(this.model)
          ? {
              thinking: { type: 'adaptive' as const },
              output_config: { effort: request.effort ?? ('low' as const) },
            }
          : {}),
      });
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new AIError(
          'El proveedor de IA ha limitado las peticiones. Inténtalo en unos segundos.',
          'provider',
        );
      }
      if (error instanceof Anthropic.AuthenticationError) {
        throw new AIError('La clave de la API de IA no es válida.', 'config');
      }
      throw new AIError(
        `El proveedor de IA no respondió correctamente: ${(error as Error).message}`,
        'provider',
      );
    }

    if (response.stop_reason === 'refusal') {
      throw new AIError(
        'El modelo ha rechazado la petición. Revisa el contenido del producto.',
        'provider',
      );
    }

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new AIError('El proveedor no devolvió una respuesta estructurada.', 'provider');
    }

    const parsed = request.schema.safeParse(toolUse.input);
    if (!parsed.success) {
      throw new AIError(
        `La respuesta de la IA no cumple el formato esperado: ${parsed.error.issues
          .map((i) => i.path.join('.'))
          .join(', ')}`,
        'validation',
      );
    }

    const pricing = PRICING_CENTS_PER_MTOK[this.model] ?? FALLBACK_PRICING;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    return {
      data: parsed.data,
      usage: {
        provider: this.name,
        model: this.model,
        inputTokens,
        outputTokens,
        costCents: Math.ceil(
          (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000,
        ),
      },
    };
  }
}
