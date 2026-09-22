import { z } from 'zod';

/**
 * Contratos de la capa de IA.
 *
 * Principio central — **procedencia de la información**:
 * la IA nunca debe presentar como hecho algo que el vendedor no haya dicho.
 * Por eso toda salida que describa un producto separa explícitamente:
 *   · `provided` → lo que el vendedor ha facilitado
 *   · `inferred` → lo que la IA deduce (y debe ir marcado como tal)
 *   · `missing`  → lo que falta y conviene preguntar
 */

// ── Procedencia ──────────────────────────────────────────────────────────────

export const provenanceSchema = z.object({
  provided: z.array(z.string()).describe('Datos facilitados por el vendedor'),
  inferred: z.array(z.string()).describe('Deducciones de la IA, no confirmadas'),
  missing: z.array(z.string()).describe('Información que falta y conviene añadir'),
});
export type Provenance = z.infer<typeof provenanceSchema>;

// ── Entrada de producto ──────────────────────────────────────────────────────

export const productInputSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(100).nullable().default(null),
  model: z.string().max(100).nullable().default(null),
  category: z.string().max(100),
  condition: z.string().max(60),
  priceCents: z.number().int().min(0).max(100_000_000),
  /** Características tal y como las ha declarado el vendedor. */
  features: z.record(z.string(), z.string()).default({}),
  notes: z.string().max(2000).nullable().default(null),
});
export type ProductInput = z.infer<typeof productInputSchema>;

// ── generateListing / improveListing ─────────────────────────────────────────

export const generatedListingSchema = z.object({
  title: z.string().max(120),
  description: z.string().max(4000),
  /** Sólo características que el vendedor haya declarado. */
  features: z.record(z.string(), z.string()),
  hashtags: z.array(z.string().max(30)).max(10),
  suggestedPriceCents: z.number().int().min(0),
  priceRationale: z.string().max(600),
  recommendations: z.array(z.string().max(300)).max(10),
  provenance: provenanceSchema,
});
export type GeneratedListing = z.infer<typeof generatedListingSchema>;

// ── optimizeListing ──────────────────────────────────────────────────────────

export const listingScoreSchema = z.object({
  title: z.number().int().min(0).max(10),
  description: z.number().int().min(0).max(10),
  photos: z.number().int().min(0).max(10),
  information: z.number().int().min(0).max(10),
});
export type ListingScore = z.infer<typeof listingScoreSchema>;

export const optimizationSchema = z.object({
  scores: listingScoreSchema,
  /** Recomendaciones concretas y accionables. */
  recommendations: z.array(z.string().max(300)).max(12),
  /** Datos que faltan en el anuncio. */
  missingInformation: z.array(z.string().max(200)).max(10),
  /** Posibles errores detectados (contradicciones, datos incoherentes). */
  possibleErrors: z.array(z.string().max(200)).max(10),
});
export type Optimization = z.infer<typeof optimizationSchema>;

// ── analyzeConversation / generateReply ──────────────────────────────────────

export const conversationAnalysisSchema = z.object({
  intent: z.enum(['question', 'offer', 'availability', 'logistics', 'complaint', 'other']),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  /** Oferta detectada en el mensaje, en céntimos. `null` si no hay. */
  detectedOfferCents: z.number().int().min(0).nullable(),
  summary: z.string().max(400),
  /** Preguntas del comprador que siguen sin responder. */
  openQuestions: z.array(z.string().max(200)).max(8),
  suggestedPriority: z.enum(['low', 'normal', 'high']),
});
export type ConversationAnalysis = z.infer<typeof conversationAnalysisSchema>;

export const replyDraftSchema = z.object({
  /** Borrador. NUNCA se envía solo: lo revisa y envía una persona. */
  body: z.string().max(1500),
  tone: z.enum(['cordial', 'directo', 'firme']),
  /** Puntos que la IA no puede responder por falta de datos. */
  cannotAnswer: z.array(z.string().max(200)).max(6),
});
export type ReplyDraft = z.infer<typeof replyDraftSchema>;

// ── negotiate ────────────────────────────────────────────────────────────────

export const negotiationOptionSchema = z.object({
  action: z.enum(['counter', 'accept', 'reject', 'hold']),
  amountCents: z.number().int().min(0).nullable(),
  label: z.string().max(120),
  rationale: z.string().max(400),
});

export const negotiationAdviceSchema = z.object({
  offerCents: z.number().int().min(0),
  /** `true` si la oferta queda por debajo del mínimo configurado. */
  belowMinimum: z.boolean(),
  options: z.array(negotiationOptionSchema).min(1).max(5),
  /** Recomendación de la IA. La decisión sigue siendo humana. */
  recommendation: z.string().max(400),
});
export type NegotiationAdvice = z.infer<typeof negotiationAdviceSchema>;

// ── analyzeProduct ───────────────────────────────────────────────────────────

export const productAnalysisSchema = z.object({
  suggestedCategory: z.string().max(100),
  suggestedPriceCents: z.number().int().min(0).nullable(),
  priceRationale: z.string().max(400),
  provenance: provenanceSchema,
  recommendations: z.array(z.string().max(300)).max(8),
});
export type ProductAnalysis = z.infer<typeof productAnalysisSchema>;

// ── generateImagePrompt ──────────────────────────────────────────────────────

export const imagePromptSchema = z.object({
  prompt: z.string().max(1200),
  /** Restricciones de veracidad incluidas en el prompt. */
  constraints: z.array(z.string().max(200)),
  /** `false` si la edición pedida podría inducir a error al comprador. */
  safe: z.boolean(),
  /** Motivo cuando `safe === false`. */
  refusalReason: z.string().max(300).nullable(),
});
export type ImagePrompt = z.infer<typeof imagePromptSchema>;

// ── Metadatos de uso ─────────────────────────────────────────────────────────

export interface AIUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}

export interface AIResult<T> {
  data: T;
  usage: AIUsage;
}

/** Error de la capa de IA con causa distinguible para el manejo en la API. */
export class AIError extends Error {
  constructor(
    message: string,
    readonly reason: 'provider' | 'validation' | 'budget' | 'config',
  ) {
    super(message);
    this.name = 'AIError';
  }
}
