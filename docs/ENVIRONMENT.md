# Variables de entorno

Plantilla completa en [`.env.example`](../.env.example). Cópiala a `.env.local`
en local, o pégalas en Vercel en producción.

**Regla:** sólo las variables `NEXT_PUBLIC_*` llegan al navegador. Todo lo demás
se queda en el servidor. Ninguna clave secreta lleva ese prefijo.

El arranque valida el entorno (`src/lib/config/env.ts`). Si falta algo, la
aplicación **falla al arrancar** diciendo exactamente qué, no a mitad de la
petición de un usuario.

Una variable creada pero **vacía** cuenta como no configurada. Eso permite dejar
en blanco las opcionales sin romper nada.

---

## Obligatorias

Sin estas cinco la aplicación no arranca.

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Misma pantalla → clave `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Misma pantalla → clave `service_role`. ⚠️ **Ignora RLS** |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` |

> ⚠️ Si cambias `TOKEN_ENCRYPTION_KEY`, los tokens ya guardados dejan de poder
> descifrarse y todas las cuentas tendrán que reconectarse. Guárdala aparte.

## Con valor por defecto

| Variable | Por defecto | Qué hace |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | URL pública. En producción, tu dominio |
| `SUPABASE_STORAGE_BUCKET` | `product-images` | Bucket de fotos. Lo crea la migración |
| `ANTHROPIC_MODEL` | `claude-opus-5` | Modelo del texto que se publica |
| `ANTHROPIC_MODEL_FAST` | `claude-haiku-4-5` | Modelo económico para chat y análisis |
| `AI_DAILY_BUDGET_CENTS` | `500` | Tope por usuario y día, en céntimos de dólar. `0` = sin tope |
| `IMAGE_PROVIDER` | `none` | `none`, `gemini` u `openai` |

## Opcionales

| Variable | Cuándo hace falta |
|---|---|
| `GEMINI_API_KEY` | Si `IMAGE_PROVIDER=gemini` |
| `GEMINI_IMAGE_MODEL` | Por defecto `gemini-2.5-flash-image` |
| `OPENAI_API_KEY` | Si `IMAGE_PROVIDER=openai` |
| `OPENAI_IMAGE_MODEL` | Por defecto `gpt-image-1` |

## Wallapop — las tres juntas o ninguna

| Variable | Notas |
|---|---|
| `WALLAPOP_CLIENT_ID` | Del alta como aplicación integradora |
| `WALLAPOP_CLIENT_SECRET` | Sólo servidor |
| `WALLAPOP_REDIRECT_URI` | Debe coincidir **exactamente** con la registrada |

Si pones una sola, el arranque falla avisando: media integración es peor que
ninguna, porque se rompe a mitad del flujo de conexión.

**Sin ellas la aplicación funciona entera** salvo conectar cuentas y publicar.

---

## Qué NO se guarda nunca

- La contraseña de Wallapop del usuario. **No se pide, no se usa, no se
  almacena.** La autorización es siempre por OAuth.
- Tokens OAuth en texto plano. Se cifran con AES-256-GCM.
- Cookies de sesión de Wallapop.
- Datos personales de compradores más allá de un alias.
