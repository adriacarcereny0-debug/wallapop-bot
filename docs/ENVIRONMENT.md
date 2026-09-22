# Variables de entorno

Plantilla completa en [`.env.example`](../.env.example). Cópiala a `.env.local`.

**Regla:** sólo las variables `NEXT_PUBLIC_*` llegan al navegador. Todo lo demás
se queda en el servidor. Ninguna clave secreta lleva ese prefijo, y el esquema
de validación lo impide por diseño.

El arranque valida el entorno (`src/lib/config/env.ts`). Si falta algo necesario
para el modo activo, la aplicación **falla al arrancar**, no a mitad de una
petición de un usuario.

---

## Aplicación

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | URL pública. En producción, tu dominio |
| `DATA_MODE` | No | `demo` | `demo` (memoria) o `supabase` |

## Supabase — obligatorias si `DATA_MODE=supabase`

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública. Es segura en el navegador **porque RLS está activado** |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ **Ignora RLS.** Sólo servidor. Nunca con prefijo `NEXT_PUBLIC_` |

## IA

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `AI_PROVIDER` | No | `demo` | `demo` o `anthropic` |
| `ANTHROPIC_API_KEY` | Sí si `anthropic` | — | Clave de API. Sólo servidor |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-5` | Modelo a usar |
| `AI_DAILY_BUDGET_CENTS` | No | `500` | Tope orientativo por usuario y día. `0` = sin tope |

## Imágenes

| Variable | Por defecto | Descripción |
|---|---|---|
| `IMAGE_PROVIDER` | `demo` | `demo`, `openai` o `gemini` |
| `OPENAI_API_KEY` | — | Si `IMAGE_PROVIDER=openai` |
| `GEMINI_API_KEY` | — | Si `IMAGE_PROVIDER=gemini` |

## Wallapop — obligatorias si `WALLAPOP_INTEGRATION_ENABLED=true`

> Antes de activarla, lee [`WALLAPOP_INTEGRATION.md`](WALLAPOP_INTEGRATION.md).
> Requiere cuenta de vendedor profesional y alta como aplicación integradora.

| Variable | Descripción |
|---|---|
| `WALLAPOP_INTEGRATION_ENABLED` | `false` por defecto. Con `false`, nada sale hacia Wallapop |
| `WALLAPOP_CLIENT_ID` | `client_id` de la aplicación integradora |
| `WALLAPOP_CLIENT_SECRET` | `client_secret`. Sólo servidor |
| `WALLAPOP_REDIRECT_URI` | Debe coincidir **exactamente** con la registrada en Wallapop |
| `TOKEN_ENCRYPTION_KEY` | Clave AES-256-GCM para cifrar los tokens OAuth |

Genera la clave de cifrado con:

```bash
openssl rand -base64 32
```

⚠️ **Si cambias `TOKEN_ENCRYPTION_KEY`, los tokens guardados dejan de poder
descifrarse** y todas las cuentas tendrán que reconectarse. Guárdala como
cualquier otro secreto crítico.

---

## Combinaciones válidas

| Escenario | `DATA_MODE` | `AI_PROVIDER` | `WALLAPOP_INTEGRATION_ENABLED` | Coste |
|---|---|---|---|---|
| Explorar la interfaz | `demo` | `demo` | `false` | 0 € |
| Probar la IA de verdad | `demo` | `anthropic` | `false` | Sólo IA |
| Preproducción | `supabase` | `anthropic` | `false` | IA + Supabase |
| Producción | `supabase` | `anthropic` | `true` | Todo |

Se recomienda recorrer los escenarios en orden. Wallapop **no tiene entorno de
pruebas**: cuando llegues al último, cada llamada afecta a tu cuenta real.

---

## Qué NO se guarda nunca

- La contraseña de Wallapop del usuario. **No se pide, no se usa, no se
  almacena.** La autorización es siempre por OAuth.
- Tokens OAuth en texto plano. Se cifran con AES-256-GCM antes de escribirse.
- Cookies de sesión de Wallapop.
- Datos personales de compradores más allá de un alias.
