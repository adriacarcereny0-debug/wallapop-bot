# APIs externas: qué se usa, qué cuesta y qué alternativas hay

## Resumen: lo que hace falta

| Servicio | ¿Obligatorio? | Plan gratuito | Coste real esperado |
|---|---|---|---|
| **Supabase** (base de datos, login, fotos) | Sí | 500 MB BD · 1 GB fotos · 50.000 usuarios/mes | **0 €** |
| **Vercel** (alojamiento) | Sí | 100 GB de tráfico | **0 €** |
| **Anthropic** (textos con IA) | Sí | No tiene | **~5–15 €/mes** según uso |
| **Google Gemini** (mejorar fotos) | No | Sí, el más generoso | **0 €** |
| **Wallapop Connect** (publicar) | No | — | 0 €, pero exige **Wallapop Pro** |

**Total para empezar: unos 5–10 € al mes**, que es prácticamente todo consumo
de IA. El resto se queda en plan gratuito mucho tiempo.

---

## 1. Base de datos: Supabase

**Por qué Supabase y no otra cosa.** Trae en un solo servicio las tres cosas que
hacen falta —PostgreSQL de verdad, autenticación y almacenamiento de ficheros—
y su seguridad a nivel de fila (RLS) es justo lo que necesita una aplicación
multicuenta. Montar eso por separado costaría más dinero y más trabajo.

**Nivel gratuito:** 500 MB de base de datos, 1 GB de ficheros, 50.000 usuarios
activos al mes, peticiones ilimitadas.

**Lo que hay que saber:** un proyecto gratuito **se pausa tras 7 días sin
actividad**. Para uso diario no molesta; si llega a molestar, el plan Pro son
25 $/mes. Además el plan gratuito **no hace copias de seguridad**: exporta de
vez en cuando con `npx supabase db dump -f copia.sql`.

**Alternativas:** Neon (Postgres, buen plan gratuito, pero sin auth ni storage:
habría que añadir dos servicios más) o Railway (sin plan gratuito permanente).
Para este proyecto no compensan.

---

## 2. Alojamiento: Vercel

**Por qué.** Es de los mismos que hacen Next.js: se despliega sin configurar
nada y cada `git push` publica solo.

**Nivel gratuito (Hobby):** 100 GB de tráfico al mes y dominio propio incluido.

**Lo que hay que saber:** el plan Hobby es para **uso no comercial**. Si esto se
factura a un cliente, técnicamente toca el plan Pro (20 $/mes). Merece la pena
leer sus condiciones antes de facturar.

**Alternativas:** Netlify (parecido), Railway o Fly.io (más control, ~5 $/mes).

---

## 3. Textos con IA: Anthropic (Claude)

**Por qué Claude.** Escribe en español de España con naturalidad, y —lo que más
importa aquí— respeta bien las instrucciones de no inventarse datos, que es el
riesgo central de este producto: un anuncio con características falsas
perjudica al comprador y expone al vendedor.

**No tiene plan gratuito.** Se paga por uso, con saldo por adelantado: se recarga
5 o 10 $ y no hay sorpresas.

### Precios (por millón de tokens)

| Modelo | Entrada | Salida | Para qué |
|---|---|---|---|
| `claude-opus-5` | 5 $ | 25 $ | El texto que se publica |
| `claude-sonnet-5` | 2 $ | 10 $ | Equilibrio |
| `claude-haiku-4-5` | 1 $ | 5 $ | Respuestas de chat, análisis |

### La aplicación usa dos modelos a la vez, y por eso sale barata

Está montada así a propósito:

- **`ANTHROPIC_MODEL`** (por defecto `claude-opus-5`) escribe títulos,
  descripciones y optimizaciones. Es texto que acaba publicado: la calidad se
  nota y se paga.
- **`ANTHROPIC_MODEL_FAST`** (por defecto `claude-haiku-4-5`) hace los
  borradores de respuesta y el análisis de conversaciones. Eso es trabajo de
  usar y tirar, y un modelo económico da el mismo resultado.

Además se usa esfuerzo de razonamiento bajo, que recorta bastante el gasto sin
que se note en el resultado.

### Cuánto cuesta en la práctica

| Acción | Coste aproximado |
|---|---|
| Generar un anuncio completo | ~0,02 $ |
| Optimizar un anuncio | ~0,01 $ |
| Borrador de respuesta a comprador | ~0,002 $ |

**200 anuncios y 500 respuestas al mes ≈ 5 $.**

### Si quieres gastar aún menos

Pon `ANTHROPIC_MODEL=claude-sonnet-5`. Baja el coste de los anuncios a menos de
la mitad y la calidad sigue siendo buena. Con `claude-haiku-4-5` sale a una
quinta parte, pero los textos pierden matiz.

### Control de gasto ya incluido

1. `AI_DAILY_BUDGET_CENTS` fija un tope por usuario y día.
2. Límite de peticiones por minuto en cada endpoint de IA, para que un bucle
   accidental no dispare la factura.
3. La tabla `ai_generations` guarda tokens y coste de **cada** llamada, así que
   siempre se sabe en qué se va el dinero.

### Alternativas

- **OpenAI** (GPT): calidad parecida, precio similar, sin plan gratuito.
- **Google Gemini**: tiene plan gratuito para texto, pero con límites bajos y
  cambiantes. Serviría para pruebas, no para producción.
- **Modelos locales** (Ollama): gratis, pero necesitan un servidor con GPU. Para
  este volumen no compensa.

Cambiar de proveedor está previsto: ver «Cambiar de proveedor» más abajo.

---

## 4. Mejorar fotos: Google Gemini

**Por qué Gemini y no otro.** Tiene **el mejor plan gratuito** para edición de
imágenes con diferencia, y su modelo de imagen (`gemini-2.5-flash-image`,
conocido como «Nano Banana») hace bien exactamente lo que necesitamos: cambiar
el fondo y corregir la luz **sin tocar el objeto**.

**Nivel gratuito:** varios cientos de peticiones al día. Para un vendedor que
sube 20 o 30 fotos diarias, sobra. Ojo: Google recortó estas cuotas en diciembre
de 2025, así que conviene consultar
[los límites vigentes](https://ai.google.dev/gemini-api/docs/rate-limits).

**Cómo se consigue la clave:** [aistudio.google.com/apikey](https://aistudio.google.com/apikey),
botón *Create API key*. No pide tarjeta.

**Alternativa:** OpenAI `gpt-image-1` (variable `IMAGE_PROVIDER=openai`). Mejor
en algunos casos, pero **sin plan gratuito**: sólo compensa si ya pagas OpenAI.

### Lo que esta aplicación NO deja hacer con las fotos

Sólo hay tres ediciones disponibles, y son un catálogo cerrado en el código:

1. Fondo neutro
2. Mejorar iluminación
3. Enderezar y encuadrar

**No se puede borrar un arañazo, añadir accesorios, cambiar el color ni simular
otro modelo.** No es una limitación técnica: es deliberado. Una foto retocada
que oculte un golpe convierte una venta legítima en un engaño al comprador. Hay
tests que comprueban que esas ediciones no existen en la interfaz y que las
reglas de veracidad viajan siempre en la instrucción al modelo.

La foto original **nunca se sustituye**: la versión mejorada se añade aparte y
marcada como tal, para poder comparar siempre con la real.

---

## 5. Wallapop Connect

No cuesta dinero, pero:

- Exige cuenta de **vendedor profesional**.
- Publicar y despublicar exige **Wallapop Pro**.
- Hay que solicitar el alta como aplicación integradora y esperar respuesta.

Detalle completo en [`WALLAPOP_INTEGRATION.md`](WALLAPOP_INTEGRATION.md).

---

## Cambiar de proveedor de IA

La aplicación nunca llama a un SDK directamente: todo pasa por la interfaz
`AIProvider`. Añadir un proveedor es implementar un método.

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
      usage: { provider: this.name, model: this.model, /* … */ costCents: 0 },
    };
  }
}
```

**2.** Añádelo a `createProviders()` en `src/lib/ai/service.ts`.

**3.** Amplía el esquema de entorno en `src/lib/config/env.ts`.

**4.** `npm test`. Los tests de IA corren contra un proveedor determinista, así
que siguen sirviendo de red de seguridad.

**Ni una línea de interfaz cambia.** Ese es el objetivo del diseño.
