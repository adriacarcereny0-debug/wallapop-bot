import type { AIProvider, CompletionRequest } from '../provider';
import { AIError, type AIResult } from '../types';

/** Importe en formato español: «660,00 €», no «660.00 €». */
const eur = (cents: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);

/**
 * Proveedor de demostración: determinista, local y de coste cero.
 *
 * Genera respuestas plausibles a partir del propio prompt, sin llamar a ninguna
 * API. Respeta el mismo contrato que un proveedor real, incluida la separación
 * de procedencia: sólo marca como "provided" lo que aparece en la entrada.
 *
 * Su razón de ser: permitir recorrer toda la aplicación —y su flujo de revisión
 * humana— sin gastar un céntimo ni tocar un servicio externo.
 */
export class DemoAIProvider implements AIProvider {
  readonly name = 'demo';
  readonly model = 'demo-deterministic';

  async complete<T>(request: CompletionRequest<T>): Promise<AIResult<T>> {
    const payload = this.build(request);

    const parsed = request.schema.safeParse(payload);
    if (!parsed.success) {
      throw new AIError(
        `El proveedor demo no sabe responder a «${request.fn}». ` +
          'Añade un caso en src/lib/ai/providers/demo.ts.',
        'config',
      );
    }

    return {
      data: parsed.data,
      usage: {
        provider: this.name,
        model: this.model,
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
      },
    };
  }

  /**
   * Extrae un campo del prompt, que se construye como `Etiqueta: valor`.
   * La etiqueta se escapa: hay rótulos con paréntesis, p. ej.
   * «Oferta recibida (céntimos)».
   */
  private field(prompt: string, label: string): string | null {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`^${escaped}:\\s*(.+)$`, 'im').exec(prompt);
    return match?.[1]?.trim() || null;
  }

  private build(request: CompletionRequest<unknown>): unknown {
    const p = request.prompt;
    const name = this.field(p, 'Producto') ?? 'Producto';
    const condition = this.field(p, 'Estado');
    const priceRaw = this.field(p, 'Precio');
    const priceCents = priceRaw ? Math.round(parseFloat(priceRaw.replace(',', '.')) * 100) : 0;

    // Características declaradas en el prompt como "- Clave: valor".
    const features: Record<string, string> = {};
    for (const line of p.split('\n')) {
      const m = /^-\s*([^:]+):\s*(.+)$/.exec(line.trim());
      if (m?.[1] && m[2]) features[m[1].trim()] = m[2].trim();
    }

    const provided = [
      `Nombre: ${name}`,
      ...(condition ? [`Estado: ${condition}`] : []),
      ...Object.entries(features).map(([k, v]) => `${k}: ${v}`),
    ];

    switch (request.fn) {
      case 'generateListing':
      case 'improveListing': {
        const featureLine = Object.entries(features)
          .map(([k, v]) => `${k}: ${v}`)
          .join('. ');
        return {
          title: [name, condition].filter(Boolean).join(' · ').slice(0, 120),
          description:
            `${name}${condition ? ` en estado ${condition.toLowerCase()}` : ''}. ` +
            `${featureLine ? `${featureLine}. ` : ''}` +
            'Los datos de este anuncio son los facilitados por el vendedor. ' +
            'Pregunta sin compromiso para cualquier duda.',
          features,
          hashtags: name
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3)
            .slice(0, 4),
          suggestedPriceCents: priceCents,
          priceRationale:
            'Precio propuesto igual al indicado por el vendedor. El modo demo no ' +
            'consulta precios de mercado reales.',
          recommendations: [
            'Añade la primera fotografía en vista frontal, con buena luz.',
            'Indica en el título el dato diferenciador (capacidad, talla o medida).',
            'Confirma qué accesorios se incluyen exactamente.',
          ],
          provenance: {
            provided,
            inferred: ['Categoría deducida a partir del nombre del producto'],
            missing: [
              ...(condition ? [] : ['Estado del producto']),
              ...(Object.keys(features).length ? [] : ['Características técnicas']),
              'Accesorios incluidos',
            ],
          },
        };
      }

      case 'optimizeListing': {
        const description = this.field(p, 'Descripción') ?? '';
        const title = this.field(p, 'Título') ?? '';
        const photoCount = Number(this.field(p, 'Número de fotos') ?? '0');

        // Puntuación determinista a partir de señales objetivas del anuncio.
        const score = (value: number, max: number) =>
          Math.max(1, Math.min(10, Math.round((value / max) * 10)));

        return {
          scores: {
            title: score(Math.min(title.length, 70), 70),
            description: score(Math.min(description.length, 400), 400),
            photos: score(Math.min(photoCount, 6), 6),
            information: score(Object.keys(features).length, 5),
          },
          recommendations: [
            title.length < 30
              ? 'El título es corto: añade marca, modelo y el dato diferenciador.'
              : 'El título tiene una longitud adecuada.',
            description.length < 150
              ? 'La descripción es breve: detalla estado, uso y accesorios incluidos.'
              : 'La descripción tiene un desarrollo razonable.',
            photoCount < 3
              ? 'Añade más fotografías: frontal, trasera y detalle de cualquier marca.'
              : 'El número de fotografías es suficiente.',
          ],
          missingInformation: [
            ...(features['Accesorios'] ? [] : ['Accesorios incluidos']),
            ...(condition ? [] : ['Estado del producto']),
          ],
          possibleErrors: [],
        };
      }

      case 'analyzeConversation': {
        const message = this.field(p, 'Último mensaje') ?? '';
        const offerMatch = /(\d+(?:[.,]\d+)?)\s*(?:€|eur)/i.exec(message);
        const offerCents = offerMatch?.[1]
          ? Math.round(parseFloat(offerMatch[1].replace(',', '.')) * 100)
          : null;

        return {
          intent: offerCents !== null ? 'offer' : 'question',
          sentiment: 'neutral',
          detectedOfferCents: offerCents,
          summary:
            offerCents !== null
              ? `El comprador ofrece ${eur(offerCents)}.`
              : 'El comprador plantea una consulta sobre el producto.',
          openQuestions: message.includes('?') ? [message.trim()] : [],
          suggestedPriority: offerCents !== null ? 'high' : 'normal',
        };
      }

      case 'generateReply': {
        const message = this.field(p, 'Último mensaje') ?? '';
        const offerMatch = /(\d+(?:[.,]\d+)?)\s*(?:€|eur)/i.exec(message);

        return {
          body: offerMatch
            ? '¡Hola! Gracias por tu interés. Por ese precio no me encaja, pero ' +
              'podemos acercar posturas. ¿Te va bien que lo hablemos?'
            : '¡Hola! Gracias por escribir. Te confirmo los datos que me preguntas ' +
              'en cuanto los revise. ¿Necesitas saber algo más del producto?',
          tone: 'cordial',
          cannotAnswer: message.includes('?')
            ? ['Confirma los datos concretos que pregunta el comprador antes de enviar.']
            : [],
        };
      }

      case 'negotiate': {
        const offerCents = Number(this.field(p, 'Oferta recibida (céntimos)') ?? '0');
        const targetCents = Number(this.field(p, 'Precio objetivo (céntimos)') ?? '0');
        const minCents = Number(this.field(p, 'Precio mínimo (céntimos)') ?? '0');
        const belowMinimum = offerCents < minCents;

        // Punto medio entre la oferta y el objetivo, nunca por debajo del mínimo.
        const midpoint = Math.max(minCents, Math.round((offerCents + targetCents) / 2));

        return {
          offerCents,
          belowMinimum,
          options: [
            {
              action: 'counter',
              amountCents: targetCents,
              label: `Contraofertar ${eur(targetCents)}`,
              rationale: 'Mantiene el precio objetivo y deja margen para una segunda ronda.',
            },
            {
              action: 'counter',
              amountCents: midpoint,
              label: `Contraofertar ${eur(midpoint)}`,
              rationale: 'Punto intermedio que respeta el mínimo configurado.',
            },
            belowMinimum
              ? {
                  action: 'reject',
                  amountCents: null,
                  label: 'Rechazar la oferta',
                  rationale: 'La oferta queda por debajo del mínimo que has fijado.',
                }
              : {
                  action: 'accept',
                  amountCents: offerCents,
                  label: `Aceptar ${eur(offerCents)}`,
                  rationale: 'La oferta está dentro del margen que has configurado.',
                },
          ],
          recommendation: belowMinimum
            ? `La oferta (${eur(offerCents)}) está por debajo de tu mínimo ` +
              `(${eur(minCents)}). Conviene contraofertar en lugar de aceptar.`
            : `La oferta respeta tu mínimo. Puedes aceptar o intentar acercarte al objetivo ` +
              `de ${eur(targetCents)}.`,
        };
      }

      case 'analyzeProduct':
        return {
          suggestedCategory: this.field(p, 'Categoría') ?? 'Otros',
          suggestedPriceCents: priceCents || null,
          priceRationale:
            'El modo demo no consulta precios de mercado. Revisa anuncios similares ' +
            'antes de fijar el precio definitivo.',
          provenance: {
            provided,
            inferred: ['Categoría deducida del nombre'],
            missing: ['Accesorios incluidos', 'Antigüedad o fecha de compra'],
          },
          recommendations: [
            'Completa marca y modelo para mejorar la clasificación del anuncio.',
            'Define el precio mínimo antes de empezar a negociar.',
          ],
        };

      case 'generateImagePrompt': {
        const requested = (this.field(p, 'Edición solicitada') ?? '').toLowerCase();

        // Lista de ediciones que falsearían el producto.
        const forbidden = [
          'arañazo',
          'aranazo',
          'rayad',
          'golpe',
          'defecto',
          'daño',
          'dano',
          'desgaste',
          'color',
          'accesorio',
          'nuevo',
          'unidades',
        ];
        const violation = forbidden.find((term) => requested.includes(term));

        if (violation) {
          return {
            prompt: '',
            constraints: [],
            safe: false,
            refusalReason:
              `La edición solicitada afectaría a «${violation}», lo que podría inducir a ` +
              'error al comprador sobre el estado real del producto. No se puede aplicar.',
          };
        }

        return {
          prompt:
            `Fotografía de producto de ${name} sobre fondo neutro claro, iluminación ` +
            'suave y uniforme, sin sombras duras, encuadre centrado, proporciones ' +
            'reales y sin retocar el estado del objeto.',
          constraints: [
            'No eliminar ni disimular marcas de uso, arañazos o golpes.',
            'No añadir accesorios que no se incluyan en la venta.',
            'No alterar el color real del producto.',
            'No modificar el modelo ni la cantidad de unidades.',
          ],
          safe: true,
          refusalReason: null,
        };
      }

      default:
        return null;
    }
  }
}
