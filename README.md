# Wallapop Assistant

Panel privado de gestión asistida por IA para vendedores profesionales con
**varias cuentas de Wallapop**. Centraliza catálogo, anuncios, conversaciones y
ventas, y usa IA para **preparar** trabajo que una persona revisa y aprueba.

Es una aplicación de producción: **no tiene modo demo**. Sin base de datos y sin
clave de IA no arranca, a propósito.

---

## Empezar aquí

👉 **[`docs/PUESTA_EN_MARCHA.md`](docs/PUESTA_EN_MARCHA.md)** — guía paso a paso,
45 minutos, de cero a funcionando.

👉 **[`docs/WALLAPOP_INTEGRATION.md`](docs/WALLAPOP_INTEGRATION.md)** — qué
permite automatizar Wallapop oficialmente y qué no. Varias funciones
solicitadas **no tienen API** y se entregan en modo asistido. Está documentado,
no escondido.

---

## Arranque en local

```bash
git clone https://github.com/adriacarcereny0-debug/wallapop-bot.git
cd wallapop-bot
npm install
cp .env.example .env.local   # rellena las 5 variables obligatorias
npm run dev
```

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
| **Panel** | Cifras de todas las cuentas, alertas, actividad y lo que espera aprobación |
| **Cuentas** | Alta de cuentas, conexión por OAuth y guía integrada para el cliente |
| **Productos** | Catálogo central, fotografías y mejora de imágenes con IA |
| **Anuncios** | Edición, optimización y publicación en Wallapop |
| **Conversaciones** | Modo asistente: la IA analiza y propone; tú envías |
| **Ventas** | Registro de ventas por cuenta y producto |
| **Estudio de IA** | Generador de anuncios con pantalla de revisión obligatoria |
| **Integración** | Mapa honesto de qué se puede automatizar y qué no |
| **Ajustes** | Configuración activa de la instancia |

## Arquitectura

```
Navegador
   │
Middleware            ── refresca la sesión y bloquea las rutas privadas
   │
Next.js App Router    ── Server Components para leer, server actions para escribir
   │
Capa de datos         ── SupabaseRepository, siempre filtrando por user_id
   │
PostgreSQL (Supabase) ── RLS activado en las 13 tablas
   │
Capa de IA            ── AIProvider: modelo principal + modelo económico
   │
Wallapop Connect API  ── OAuth 2.0 + PKCE, tokens cifrados
```

Detalle en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

### Decisiones de fondo

- **Aislamiento multicuenta en tres capas.** RLS en base de datos, filtro por
  `user_id` en cada consulta del repositorio, y validación del filtro de cuenta
  contra las cuentas reales del usuario. Verificado con tests contra PostgreSQL:
  un usuario no puede leer, modificar ni borrar datos de otro.
- **La IA nunca inventa.** Toda salida que describe un producto separa lo
  *facilitado*, lo *deducido* y lo que *falta*. Se ve en la pantalla de revisión.
- **Nada sale sin aprobación humana.** No hay envío automático de mensajes ni
  aceptación automática de ofertas: no existe API para ello, y tampoco se ha
  implementado ningún sustituto.
- **Las fotos no pueden mentir.** El catálogo de ediciones es cerrado: fondo,
  luz y encuadre. Nada que oculte un daño o añada lo que no hay.
- **El dinero va en céntimos**, siempre entero. Nunca coma flotante.

---

## Documentación

| Documento | Contenido |
|---|---|
| [`PUESTA_EN_MARCHA.md`](docs/PUESTA_EN_MARCHA.md) | **Empieza aquí.** De cero a funcionando |
| [`WALLAPOP_INTEGRATION.md`](docs/WALLAPOP_INTEGRATION.md) | Qué permite Wallapop y qué no |
| [`FEATURES.md`](docs/FEATURES.md) | Lo implementado y lo que no puede implementarse |
| [`AI_PROVIDERS.md`](docs/AI_PROVIDERS.md) | APIs, costes reales y alternativas gratuitas |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura, capas y modelo de datos |
| [`ENVIRONMENT.md`](docs/ENVIRONMENT.md) | Todas las variables de entorno |
| [`SUPABASE.md`](docs/SUPABASE.md) | Base de datos y RLS en detalle |
| [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Despliegue y paso a producción |
| [`RUNBOOK.md`](docs/RUNBOOK.md) | Operación diaria e incidencias |
| [`PRODUCT.md`](PRODUCT.md) · [`DESIGN.md`](DESIGN.md) | Contexto de producto y sistema de diseño |

`reference/wallapop-openapi/` guarda las especificaciones OpenAPI de Wallapop
sobre las que se construyó el análisis, para poder auditar cada afirmación.

## Seguridad

- Supabase Auth. La sesión se valida contra el servidor (`getUser()`), no se lee
  de la cookie.
- Middleware que protege todas las rutas privadas.
- RLS en las 13 tablas, más filtro explícito por `user_id` en cada consulta.
- Claves de API sólo en el servidor. **Ninguna lleva prefijo `NEXT_PUBLIC_`.**
- Tokens OAuth de Wallapop cifrados con AES-256-GCM antes de guardarse.
- **La contraseña de Wallapop nunca se pide, ni se usa, ni se almacena.**
- Validación con Zod en el servidor en toda entrada.
- Límite de peticiones en los endpoints de IA.
- Webhooks verificados por HMAC-SHA256 con ventana anti-repetición.

## Licencia

Proyecto privado. Todos los derechos reservados.
