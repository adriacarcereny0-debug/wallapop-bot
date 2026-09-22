# Capa de IA y proveedores

## Diseño

```
Componente → Ruta API → AIService → AIProvider → SDK
```

Reglas que sostienen el diseño:

1. **Ningún componente de interfaz llama a un proveedor de IA.** La UI habla con
   rutas API; las rutas hablan con `AIService`.
2. **Las claves viven sólo en el servidor.** Ninguna lleva `NEXT_PUBLIC_`.
3. **Toda salida se valida contra un esquema Zod.** Si no cumple, se lanza
   `AIError`, no se propagan datos malformados.

## Las ocho funciones

| Función | Qué hace | Esquema |
|---|---|---|
| `generateListing` | Título, descripción, características y precio sugerido | `generatedListingSchema` |
| `improveListing` | Reescribe un anuncio existente | `generatedListingSchema` |
| `optimizeListing` | Puntúa calidad y da recomendaciones | `optimizationSchema` |
| `analyzeConversation` | Intención, sentimiento y oferta detectada | `conversationAnalysisSchema` |
| `generateReply` | Borrador de respuesta al comprador | `replyDraftSchema` |
| `negotiate` | Opciones de contraoferta | `negotiationAdviceSchema` |
| `analyzeProduct` | Categoría y precio sugeridos | `productAnalysisSchema` |
| `generateImagePrompt` | Prompt de edición, con rechazo si falsearía | `imagePromptSchema` |

---

## Garantías de veracidad

Es lo que separa esta herramienta de un generador de texto cualquiera.

### Procedencia de la información

Toda salida que describe un producto lleva un bloque `provenance`:

```ts
{
  provided: ['Nombre: iPhone 15 Pro', 'Batería: 91 %'],  // lo dijo el vendedor
  inferred: ['Categoría deducida del nombre'],           // lo dedujo la IA
  missing:  ['Accesorios incluidos']                     // falta y hay que pedirlo
}
```

La pantalla de revisión lo muestra antes de que el usuario apruebe nada. Si la
IA dedujera algo que no es cierto, el usuario lo ve marcado como deducción.

### Reglas del prompt de sistema

En `src/lib/ai/prompts.ts`, resumidas:

- Nunca afirmar una característica que el vendedor no haya facilitado.
- No inventar defectos **ni ocultarlos**.
- No prometer plazos, garantías ni devoluciones no declarados.
- No prometer visitas ni ventas.
- En negociación: nunca recomendar bajar del mínimo configurado.
- En imágenes: nunca falsear estado, daños, accesorios, modelo, color, cantidad
  ni funcionamiento.

### Verificado con tests

`src/lib/ai/ai.test.ts` comprueba que la IA no marca como facilitado lo que no
se facilitó, que no inventa características, que nunca propone contraofertas por
debajo del mínimo, y que rechaza ediciones de imagen que ocultarían daños o
añadirían accesorios inexistentes.

---

## Cambiar de proveedor

### Si ya está soportado

Cambia dos variables:

```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-…
```

### Añadir uno nuevo

**1.** Crea `src/lib/ai/providers/mi-proveedor.ts`:

```ts
import type { AIProvider, CompletionRequest } from '../provider';
import { AIError, type AIResult } from '../types';

export class MiProveedor implements AIProvider {
  readonly name = 'mi-proveedor';

  constructor(private readonly apiKey: string, readonly model: string) {}

  async complete<T>(request: CompletionRequest<T>): Promise<AIResult<T>> {
    const raw = await llamarAlSdk(request.system, request.prompt);

    // Validar SIEMPRE antes de devolver.
    const parsed = request.schema.safeParse(raw);
    if (!parsed.success) {
      throw new AIError('La respuesta no cumple el formato esperado.', 'validation');
    }

    return {
      data: parsed.data,
      usage: {
        provider: this.name,
        model: this.model,
        inputTokens: raw.usage.input,
        outputTokens: raw.usage.output,
        costCents: calcularCoste(raw.usage),
      },
    };
  }
}
```

**2.** Añádelo al selector de `src/lib/ai/service.ts`:

```ts
case 'mi-proveedor':
  return new MiProveedor(env.MI_PROVEEDOR_API_KEY!, env.MI_PROVEEDOR_MODEL);
```

**3.** Amplía el esquema de entorno en `src/lib/config/env.ts`, incluida la
comprobación de que la clave existe cuando ese proveedor está activo.

**4.** Ejecuta `npm test`. Los tests de IA corren contra el proveedor demo, así
que seguirán sirviendo de red de seguridad.

**Ni una línea de interfaz cambia.** Ese es el objetivo del diseño.

---

## Costes y modelos

Precios por millón de tokens (revisa las tarifas vigentes):

| Modelo | Entrada | Salida | Cuándo usarlo |
|---|---|---|---|
| `claude-haiku-4-5-20251001` | ~1 € | ~5 € | Respuestas de chat, análisis sencillos |
| `claude-sonnet-5` | ~3 € | ~15 € | Por defecto: buen equilibrio |
| `claude-opus-5` | ~15 € | ~75 € | Sólo si la calidad lo justifica |

Los precios de `src/lib/ai/providers/anthropic.ts` (`PRICING_CENTS_PER_MTOK`)
sirven para estimar el coste registrado en `ai_generations`. Actualízalos si
cambian las tarifas.

**Recomendación:** `claude-sonnet-5` para generar anuncios (el texto se publica,
la calidad importa) y `claude-haiku-4-5-20251001` para borradores de respuesta y
análisis de conversación, que son de usar y tirar.
