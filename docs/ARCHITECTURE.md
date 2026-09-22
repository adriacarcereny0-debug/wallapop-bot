# Arquitectura

## Stack y por qué

La consigna era «la opción más sencilla, estable y económica que cumpla todos
los requisitos».

| Capa | Elección | Motivo |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Front y back en un despliegue. Server Components evitan montar una API sólo para leer datos. Se despliega en Vercel sin configuración |
| Lenguaje | **TypeScript estricto** | Con `noUncheckedIndexedAccess`. El dominio es multicuenta: confundir un `accountId` debe fallar al compilar |
| Estilos | **Tailwind CSS v4** | Tokens en CSS nativo (`@theme`), sin fichero de configuración JS. Cero CSS en tiempo de ejecución |
| Base de datos | **PostgreSQL vía Supabase** | Postgres real con RLS, auth y almacenamiento incluidos. Plan gratuito suficiente para empezar |
| Validación | **Zod** | El mismo esquema valida la entrada HTTP y da el tipo TypeScript |
| IA | **Capa propia sobre SDK** | La aplicación nunca llama a un SDK directamente |
| Tests | **Vitest** | Rápido, sin configuración, mismo resolutor que Vite |

**Lo que se descartó a propósito:** ninguna biblioteca de componentes (peso y
pérdida de control sobre el diseño), ningún gestor de estado global (el servidor
es la fuente de verdad, el estado viaja en la URL) y ningún ORM (las consultas
son sencillas y el cliente de Supabase ya tipa).

---

## Capas

```
┌─────────────────────────────────────────────────────────┐
│ app/                                                    │
│   (app)/…   Server Components: leen por repositorio     │
│   api/…     Rutas de escritura: validan y limitan       │
├─────────────────────────────────────────────────────────┤
│ components/   UI. NUNCA llama a un proveedor de IA      │
├─────────────────────────────────────────────────────────┤
│ lib/data/     Repository ── Demo | Supabase             │
│ lib/ai/       AIService  ── AIProvider: Demo | Anthropic│
│ lib/wallapop/ Connect API + OAuth + webhooks            │
│ lib/auth/     Sesión                                    │
│ lib/http/     Límite de peticiones y errores            │
├─────────────────────────────────────────────────────────┤
│ types/domain.ts   Modelo de dominio                     │
└─────────────────────────────────────────────────────────┘
```

Regla de dependencia: **las capas de arriba conocen a las de abajo, nunca al
revés.** Un componente no importa `@anthropic-ai/sdk`, ni `lib/ai` sabe que
existe React.

---

## Multicuenta

Es el requisito estructural del proyecto.

```
usuario (1) ──< cuenta (N) ──< anuncio (N)
                          ──< conversación (N)
                          ──< venta (N)
usuario (1) ──< producto (N)      ← catálogo central, no por cuenta
```

Los productos viven a nivel de usuario **a propósito**: el mismo artículo puede
publicarse en la cuenta que convenga sin duplicar el catálogo. El vínculo con la
cuenta se establece al crear el anuncio.

### Tres barreras de aislamiento

1. **Base de datos.** RLS en todas las tablas: `auth.uid() = user_id`.
2. **Repositorio.** Cada método recibe `userId` como primer argumento y filtra
   por él, aunque RLS ya lo haga. Si una política se rompe, el filtro sigue.
3. **Interfaz.** El filtro de cuenta se valida contra las cuentas reales del
   usuario (`readAccountFilter`). Un `?cuenta=` manipulado cae a «todas», no da
   acceso a datos ajenos. Hay test para ello.

El filtro vive en la URL, no en el estado del cliente: cualquier vista se puede
compartir y recargar sin perder contexto.

---

## Capa de IA

```
Ruta API → AIService → AIProvider → (SDK)
```

`AIService` expone las ocho funciones de negocio. `AIProvider` es la interfaz
que hay que implementar para añadir un proveedor. Cambiar de proveedor no toca
ni una línea de interfaz. Ver [`AI_PROVIDERS.md`](AI_PROVIDERS.md).

**Salida estructurada.** Toda función declara un esquema Zod y el proveedor debe
devolver algo que lo cumpla. Con Anthropic se fuerza mediante `tools` +
`tool_choice`, que es más fiable que pedir JSON en el prompt. Si la respuesta no
valida, se lanza `AIError` en lugar de propagar datos malformados.

**Procedencia de la información.** Toda salida que describe un producto separa
`provided`, `inferred` y `missing`. Es el mecanismo que impide que la IA afirme
características que el vendedor no ha facilitado, y se muestra en la pantalla de
revisión para que el usuario lo vea antes de aprobar.

---

## Integración con Wallapop

Tres piezas:

- `capabilities.ts` — **la fuente de verdad.** Qué se puede automatizar, con qué
  endpoint y por qué. El cliente consulta este mapa antes de cada llamada, así
  que es imposible ejecutar una operación no declarada.
- `client.ts` — cliente tipado, con espaciador que respeta el límite de 36 req/s.
- `oauth.ts` / `crypto.ts` / `webhooks.ts` — PKCE, cifrado de tokens y
  verificación HMAC.

Todo queda inerte mientras `WALLAPOP_INTEGRATION_ENABLED=false`: el constructor
del cliente lanza antes de tocar la red.

---

## Procesos de larga duración

Vercel no ejecuta procesos persistentes, y el proyecto está diseñado para no
necesitarlos:

| Necesidad | Solución |
|---|---|
| Recibir eventos de Wallapop | **Webhooks** (`/api/wallapop/webhook`). Wallapop empuja; no hay que sondear |
| Renovar tokens OAuth | Bajo demanda, al detectar que el token ha caducado |
| Revisar anuncios | Se calcula al cargar la página, sobre datos ya presentes |

**Si en el futuro hiciera falta trabajo en segundo plano** (sincronización
periódica, reintentos de webhooks fallidos), las opciones compatibles son Vercel
Cron (gratis, 2 trabajos diarios en Hobby), Supabase Edge Functions con
`pg_cron`, o un worker aparte en Railway o Fly.io. Ninguna es necesaria hoy.
