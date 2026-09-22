# Wallapop Assistant

Panel privado de gestión asistida por IA para vendedores profesionales con
**varias cuentas de Wallapop**. Centraliza catálogo, anuncios, conversaciones y
ventas, y usa IA para **preparar** trabajo que una persona revisa y aprueba.

> **Lee esto primero:** [`docs/WALLAPOP_INTEGRATION.md`](docs/WALLAPOP_INTEGRATION.md)
> explica qué permite automatizar Wallapop de forma oficial y qué no. Varias
> funciones solicitadas **no tienen API** y se entregan en modo asistido. Está
> documentado, no escondido.

---

## Arranque rápido

```bash
git clone https://github.com/adriacarcereny0-debug/wallapop-bot.git
cd wallapop-bot
npm install
cp .env.example .env.local
npm run dev
```

Abre <http://localhost:3000>. **No hace falta configurar nada más**: con los
valores por defecto (`DATA_MODE=demo`, `AI_PROVIDER=demo`) la aplicación es
totalmente funcional, con datos ficticios y sin coste.

## Verificación

```bash
npm run verify   # tipos + lint + tests + build
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run typecheck` | TypeScript en modo estricto |
| `npm run lint` | ESLint |
| `npm test` | Tests (Vitest) |

---

## Qué hace la aplicación

| Sección | Contenido |
|---|---|
| **Panel** | Cifras de todas las cuentas, alertas, actividad reciente y lo que espera tu aprobación |
| **Cuentas** | Estado de cada cuenta de Wallapop, con sus contadores y su aislamiento de datos |
| **Productos** | Catálogo central: un producto vive una vez y se publica desde él |
| **Anuncios** | Todos los anuncios, filtrables por cuenta y estado |
| **Conversaciones** | Modo asistente: la IA analiza y propone respuesta; tú la envías |
| **Ventas** | Registro de ventas por cuenta y producto |
| **Estudio de IA** | Generador de anuncios con pantalla de revisión obligatoria |
| **Integración** | Mapa honesto de qué se puede automatizar y qué no |
| **Ajustes** | Configuración activa de la instancia |

## Arquitectura

```
Navegador
   │
Next.js App Router  ── Server Components para leer, rutas API para escribir
   │
Capa de datos        ── Repository: DemoRepository | SupabaseRepository
   │
PostgreSQL (Supabase) ── RLS activado en todas las tablas
   │
Capa de IA           ── AIProvider: DemoAIProvider | AnthropicProvider
   │
Wallapop Connect API ── OAuth 2.0 + PKCE, desactivada por defecto
```

Detalle en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

### Decisiones de fondo

- **Aislamiento multicuenta.** Toda entidad de cuenta lleva `user_id` **y**
  `account_id`. El filtro de cuenta se valida contra las cuentas del usuario, de
  modo que un `?cuenta=` manipulado no da acceso a datos ajenos.
- **La IA nunca inventa.** Toda salida que describe un producto separa lo
  *facilitado*, lo *deducido* y lo que *falta*. Se ve en la pantalla de revisión.
- **Nada sale sin aprobación humana.** No hay envío automático de mensajes ni
  aceptación automática de ofertas: no existe API para ello, y tampoco se ha
  implementado ningún sustituto.
- **El dinero va en céntimos**, siempre entero. Nunca coma flotante.
- **El modo demo no es un adorno.** Wallapop **no tiene entorno de pruebas**:
  todo se valida en producción. El modo demo es la única red de seguridad.

---

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/WALLAPOP_INTEGRATION.md`](docs/WALLAPOP_INTEGRATION.md) | **Análisis de la integración.** Qué permite Wallapop y qué no |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Lista explícita de lo implementado y de lo que no puede implementarse |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura, capas y modelo de datos |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) | Todas las variables de entorno |
| [`docs/SUPABASE.md`](docs/SUPABASE.md) | Puesta en marcha de la base de datos y RLS |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Despliegue en Vercel y paso a producción |
| [`docs/AI_PROVIDERS.md`](docs/AI_PROVIDERS.md) | Capa de IA, costes y cómo cambiar de proveedor |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Añadir cuentas, operar y resolver incidencias |
| [`PRODUCT.md`](PRODUCT.md) · [`DESIGN.md`](DESIGN.md) | Contexto de producto y sistema de diseño |

`reference/wallapop-openapi/` guarda las especificaciones OpenAPI de Wallapop
sobre las que se construyó el análisis, para poder auditar cada afirmación.

## Seguridad

- Autenticación con Supabase Auth; sesión validada contra el servidor, no leída
  de la cookie.
- RLS en todas las tablas, más filtro explícito por `user_id` en cada consulta.
- Claves de API sólo en el servidor. **Ninguna lleva prefijo `NEXT_PUBLIC_`.**
- Tokens OAuth de Wallapop cifrados con AES-256-GCM antes de guardarse.
- **La contraseña de Wallapop nunca se pide, ni se usa, ni se almacena.**
- Validación con Zod en el servidor en toda entrada.
- Límite de peticiones en los endpoints de IA.
- Webhooks verificados por HMAC-SHA256 con ventana anti-repetición.

## Costes

Arranca gratis: GitHub, Vercel Hobby y Supabase Free bastan para empezar, y el
modo demo tiene coste cero. El único gasto variable es la IA. Desglose en
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Licencia

Proyecto privado. Todos los derechos reservados.
