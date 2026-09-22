import { getEnv } from '@/lib/config/env';
import type { AIProvider } from './provider';
import { AnthropicProvider } from './providers/anthropic';
import { DemoAIProvider } from './providers/demo';
import { GROUNDING_RULES, IMAGE_RULES, NEGOTIATION_RULES, REPLY_RULES } from './prompts';
import {
  conversationAnalysisSchema,
  generatedListingSchema,
  imagePromptSchema,
  negotiationAdviceSchema,
  optimizationSchema,
  productAnalysisSchema,
  replyDraftSchema,
  type AIResult,
  type ConversationAnalysis,
  type GeneratedListing,
  type ImagePrompt,
  type NegotiationAdvice,
  type Optimization,
  type ProductAnalysis,
  type ProductInput,
  type ReplyDraft,
} from './types';

/** Formatea céntimos como importe en euros para incluirlo en un prompt. */
const euros = (cents: number) => (cents / 100).toFixed(2);

function describeProduct(product: ProductInput): string {
  const lines = [
    `Producto: ${product.name}`,
    product.brand ? `Marca: ${product.brand}` : null,
    product.model ? `Modelo: ${product.model}` : null,
    `Categoría: ${product.category}`,
    `Estado: ${product.condition}`,
    `Precio: ${euros(product.priceCents)}`,
  ].filter(Boolean);

  const features = Object.entries(product.features);
  if (features.length > 0) {
    lines.push('Características facilitadas por el vendedor:');
    for (const [key, value] of features) lines.push(`- ${key}: ${value}`);
  }
  if (product.notes) lines.push(`Notas del vendedor: ${product.notes}`);

  return lines.join('\n');
}

function createProvider(): AIProvider {
  const env = getEnv();
  switch (env.AI_PROVIDER) {
    case 'anthropic':
      return new AnthropicProvider(env.ANTHROPIC_API_KEY!, env.ANTHROPIC_MODEL);
    case 'demo':
    default:
      return new DemoAIProvider();
  }
}

/**
 * Servicio de IA: única puerta de entrada a la inteligencia artificial.
 *
 * Ningún componente de interfaz llama a un proveedor directamente. Las claves de
 * API viven sólo en el servidor y nunca cruzan al navegador.
 */
export class AIService {
  constructor(private readonly provider: AIProvider = createProvider()) {}

  get providerName(): string {
    return this.provider.name;
  }

  /** Genera título, descripción y recomendaciones para un producto nuevo. */
  generateListing(product: ProductInput): Promise<AIResult<GeneratedListing>> {
    return this.provider.complete({
      fn: 'generateListing',
      system: GROUNDING_RULES,
      schema: generatedListingSchema,
      prompt:
        `Redacta un anuncio de venta para el siguiente producto.\n\n${describeProduct(product)}\n\n` +
        'Usa únicamente los datos anteriores. Lo que no aparezca, va en "missing".',
    });
  }

  /** Reescribe un anuncio existente conservando la información veraz. */
  improveListing(
    product: ProductInput,
    current: { title: string; description: string },
  ): Promise<AIResult<GeneratedListing>> {
    return this.provider.complete({
      fn: 'improveListing',
      system: GROUNDING_RULES,
      schema: generatedListingSchema,
      prompt:
        `Mejora este anuncio sin añadir datos que el vendedor no haya facilitado.\n\n` +
        `${describeProduct(product)}\n\n` +
        `Título actual: ${current.title}\n` +
        `Descripción actual: ${current.description}`,
    });
  }

  /** Puntúa un anuncio y devuelve recomendaciones concretas. */
  optimizeListing(input: {
    title: string;
    description: string;
    priceCents: number;
    photoCount: number;
    category: string;
    features: Record<string, string>;
  }): Promise<AIResult<Optimization>> {
    const features = Object.entries(input.features)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');

    return this.provider.complete({
      fn: 'optimizeListing',
      system:
        `${GROUNDING_RULES}\n\n` +
        'Al puntuar, evalúa la CALIDAD del anuncio (claridad, completitud, ' +
        'estructura). La puntuación NO predice visitas ni ventas y no debe ' +
        'presentarse como tal.',
      schema: optimizationSchema,
      prompt:
        `Analiza este anuncio.\n\n` +
        `Título: ${input.title}\n` +
        `Descripción: ${input.description}\n` +
        `Precio: ${euros(input.priceCents)}\n` +
        `Categoría: ${input.category}\n` +
        `Número de fotos: ${input.photoCount}\n` +
        (features ? `Características:\n${features}` : 'Características: ninguna declarada'),
    });
  }

  /** Analiza una conversación y detecta intención, ofertas y dudas abiertas. */
  analyzeConversation(input: {
    listingTitle: string;
    priceCents: number;
    lastMessage: string;
    history: string[];
  }): Promise<AIResult<ConversationAnalysis>> {
    return this.provider.complete({
      fn: 'analyzeConversation',
      system: GROUNDING_RULES,
      schema: conversationAnalysisSchema,
      prompt:
        `Analiza esta conversación con un comprador.\n\n` +
        `Anuncio: ${input.listingTitle}\n` +
        `Precio publicado: ${euros(input.priceCents)}\n` +
        (input.history.length ? `Historial:\n${input.history.join('\n')}\n` : '') +
        `Último mensaje: ${input.lastMessage}`,
    });
  }

  /**
   * Redacta un BORRADOR de respuesta.
   *
   * Importante: no existe API oficial de mensajería en Wallapop, así que este
   * borrador nunca se envía solo. Lo revisa y lo envía una persona.
   */
  generateReply(input: {
    listingTitle: string;
    priceCents: number;
    minPriceCents: number | null;
    lastMessage: string;
    features: Record<string, string>;
  }): Promise<AIResult<ReplyDraft>> {
    const features = Object.entries(input.features)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');

    return this.provider.complete({
      fn: 'generateReply',
      system: REPLY_RULES,
      schema: replyDraftSchema,
      prompt:
        `Redacta un borrador de respuesta al comprador.\n\n` +
        `Anuncio: ${input.listingTitle}\n` +
        `Precio publicado: ${euros(input.priceCents)}\n` +
        (input.minPriceCents !== null
          ? `Precio mínimo aceptable (NO revelar al comprador): ${euros(input.minPriceCents)}\n`
          : '') +
        (features ? `Datos del producto:\n${features}\n` : '') +
        `Último mensaje: ${input.lastMessage}`,
    });
  }

  /** Propone opciones de negociación frente a una oferta concreta. */
  negotiate(input: {
    listingTitle: string;
    listedPriceCents: number;
    targetPriceCents: number;
    minPriceCents: number;
    offerCents: number;
  }): Promise<AIResult<NegotiationAdvice>> {
    return this.provider.complete({
      fn: 'negotiate',
      system: NEGOTIATION_RULES,
      schema: negotiationAdviceSchema,
      prompt:
        `Asesora sobre esta negociación.\n\n` +
        `Anuncio: ${input.listingTitle}\n` +
        `Precio publicado (céntimos): ${input.listedPriceCents}\n` +
        `Precio objetivo (céntimos): ${input.targetPriceCents}\n` +
        `Precio mínimo (céntimos): ${input.minPriceCents}\n` +
        `Oferta recibida (céntimos): ${input.offerCents}`,
    });
  }

  /** Clasifica un producto y sugiere precio, separando dato de deducción. */
  analyzeProduct(product: ProductInput): Promise<AIResult<ProductAnalysis>> {
    return this.provider.complete({
      fn: 'analyzeProduct',
      system: GROUNDING_RULES,
      schema: productAnalysisSchema,
      prompt: `Analiza este producto para prepararlo para la venta.\n\n${describeProduct(product)}`,
    });
  }

  /**
   * Construye el prompt para editar o generar una imagen.
   * Rechaza la petición si la edición falsearía el producto.
   */
  generateImagePrompt(input: {
    productName: string;
    condition: string;
    requestedEdit: string;
  }): Promise<AIResult<ImagePrompt>> {
    return this.provider.complete({
      fn: 'generateImagePrompt',
      system: IMAGE_RULES,
      schema: imagePromptSchema,
      prompt:
        `Producto: ${input.productName}\n` +
        `Estado: ${input.condition}\n` +
        `Edición solicitada: ${input.requestedEdit}`,
    });
  }
}

/** Instancia compartida por petición. */
export function getAIService(): AIService {
  return new AIService();
}
