import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import type { AIProvider, CompletionRequest } from '../provider';
import { AIError, type AIResult } from '../types';

/** Precios por millón de tokens, en céntimos de euro. Ajustar si cambia la tarifa. */
const PRICING_CENTS_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5': { input: 300, output: 1500 },
  'claude-opus-5': { input: 1500, output: 7500 },
  'claude-haiku-4-5-20251001': { input: 100, output: 500 },
};

const DEFAULT_PRICING = { input: 300, output: 1500 };

/**
 * Proveedor Anthropic.
 *
 * Fuerza salida JSON mediante `tools` con `tool_choice`, que es más fiable que
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
    const { z: zod } = await import('zod');
    const jsonSchema = zod.toJSONSchema(request.schema as z.ZodType, { io: 'output' });

    let response;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens ?? 2000,
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
      });
    } catch (error) {
      throw new AIError(
        `El proveedor de IA no respondió correctamente: ${(error as Error).message}`,
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

    const pricing = PRICING_CENTS_PER_MTOK[this.model] ?? DEFAULT_PRICING;
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
