# Puesta en marcha — guía paso a paso

Esta guía es para **quien monta la aplicación**, no para el cliente final.
Tiempo estimado: 45 minutos. Coste: 0 € salvo el consumo de IA.

Hay cuatro bloques. Los tres primeros son obligatorios; el cuarto depende de
Wallapop y puede tardar semanas.

---

## Bloque 1 · Base de datos (obligatorio, ~15 min)

### 1.1 Crear el proyecto

1. Entra en [supabase.com](https://supabase.com) → **New project**.
2. Nombre: `wallapop-assistant`.
3. Región: **West EU (Paris)** o **Frankfurt** — cuanto más cerca de España, menos latencia.
4. Guarda la contraseña de base de datos en un gestor de contraseñas.

> **Si te dice que has alcanzado el límite:** el plan gratuito permite 2
> proyectos activos por organización. Pausa o borra uno que no uses desde
> *Project Settings → General → Pause project*.

### 1.2 Aplicar el esquema

En el panel de Supabase, **SQL Editor** → pega entero el contenido de
[`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) → **Run**.

Crea 13 tablas, sus índices, los disparadores, el bucket de imágenes y activa
Row Level Security en todo.

### 1.3 Comprobar que la seguridad quedó activa

Este paso no es opcional. Ejecuta en el SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables where schemaname = 'public' order by tablename;
```

**Las 13 filas deben mostrar `rowsecurity = true`.** Si alguna no lo está, algo
falló: vuelve a ejecutar la migración.

### 1.4 Crear el usuario del cliente

La aplicación **no tiene registro abierto**, a propósito: es una herramienta
privada, no un servicio público.

1. **Authentication → Users → Add user → Create new user**.
2. Correo y contraseña del cliente. Marca **Auto Confirm User**.
3. El perfil interno se crea solo (lo hace un disparador).

Repite por cada persona que deba entrar.

### 1.5 Copiar las claves

**Project Settings → API**. Necesitas tres valores:

| En Supabase | Variable |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` |

> La clave `anon` es segura en el navegador **porque RLS está activado**. La
> `service_role` se salta RLS: no la compartas ni la pongas nunca en una
> variable con prefijo `NEXT_PUBLIC_`.

---

## Bloque 2 · Inteligencia artificial (obligatorio, ~5 min)

1. Entra en [console.anthropic.com](https://console.anthropic.com).
2. **API Keys → Create Key**. Cópiala: sólo se muestra una vez.
3. Añade saldo en **Plans & Billing**. Con 5–10 $ tienes para empezar de sobra.
4. Variable: `ANTHROPIC_API_KEY`.

Recomendación de coste: deja `ANTHROPIC_MODEL=claude-opus-5` (el texto que se
publica merece el mejor modelo) y `ANTHROPIC_MODEL_FAST=claude-haiku-4-5` (las
respuestas de chat son de usar y tirar). La aplicación ya usa cada uno donde
toca.

### Clave de cifrado

En una terminal:

```bash
openssl rand -base64 32
```

El resultado va en `TOKEN_ENCRYPTION_KEY`. Cifra los tokens de Wallapop antes de
guardarlos. **Guárdala aparte**: si la pierdes o la cambias, todas las cuentas
conectadas tendrán que volver a conectarse.

---

## Bloque 3 · Despliegue en Vercel (obligatorio, ~10 min)

1. [vercel.com](https://vercel.com) → **Add New Project** → importa
   `adriacarcereny0-debug/wallapop-bot`.
2. No cambies nada de la configuración: detecta Next.js solo.
3. En **Environment Variables**, añade como mínimo estas seis:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
TOKEN_ENCRYPTION_KEY
NEXT_PUBLIC_APP_URL      ← la URL final, p. ej. https://wallapop-bot.vercel.app
```

4. **Deploy**.

> ⚠️ **No dejes variables creadas y vacías.** Una variable vacía se trata como
> «no configurada», así que las opcionales pueden quedarse en blanco sin
> problema, pero si dejas vacía una obligatoria el despliegue fallará con un
> mensaje claro diciéndote cuál falta.

### Comprobación

Abre la URL. Debe aparecer la pantalla de **Entrar**. Inicia sesión con el
usuario que creaste en el paso 1.4. Si entras al panel, los tres bloques
obligatorios están bien.

---

## Bloque 4 · Wallapop (depende de ellos, plazo desconocido)

**Este es el único bloque que no depende de ti ni de mí.**

Para publicar anuncios desde la aplicación hace falta que Wallapop dé de alta
esta aplicación como **integradora** y entregue un `client_id` y un
`client_secret`. No hay forma de saltarse esto: sin esas credenciales, nadie
—ni tú, ni yo, ni ningún programa— puede publicar en Wallapop por API.

### Requisitos

1. Cuenta de **vendedor profesional** en Wallapop.
2. Suscripción **Wallapop Pro** activa (la exigen `activate` e `inactivate`).
3. Solicitar el alta como aplicación integradora en
   [developers.wallapop.com](https://developers.wallapop.com).
4. Registrar la URL de retorno:
   `https://TU-DOMINIO/api/wallapop/oauth/callback`

### Cuando te las den

Añade en Vercel las tres variables juntas:

```
WALLAPOP_CLIENT_ID
WALLAPOP_CLIENT_SECRET
WALLAPOP_REDIRECT_URI     ← idéntica a la registrada, carácter por carácter
```

Vercel redespliega solo. A partir de ese momento aparece el botón «Conectar con
Wallapop» en la sección Cuentas, y el cliente puede conectar las suyas.

> 🚨 **Wallapop no tiene entorno de pruebas.** En cuanto conectes una cuenta
> real, cada publicación afecta a tu cuenta de verdad. Prueba primero con un
> anuncio barato y poco importante.

---

## Bloque 5 · Imágenes (opcional, ~5 min)

Sin esto se pueden **subir** fotos, pero no mejorarlas con IA.

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API key**.
2. En Vercel:

```
IMAGE_PROVIDER=gemini
GEMINI_API_KEY=<tu clave>
```

El nivel gratuito de Gemini es el más generoso del mercado y sobra para el
volumen de un vendedor. Ver [`AI_PROVIDERS.md`](AI_PROVIDERS.md).

---

## Resumen: qué se puede hacer en cada momento

| Función | Bloques 1-3 | + Bloque 4 | + Bloque 5 |
|---|---|---|---|
| Entrar, catálogo, anuncios en borrador | ✅ | ✅ | ✅ |
| Generar títulos y descripciones con IA | ✅ | ✅ | ✅ |
| Optimizar anuncios | ✅ | ✅ | ✅ |
| Conversaciones y asistente de respuesta | ✅ | ✅ | ✅ |
| Asistente de negociación | ✅ | ✅ | ✅ |
| Registrar ventas y estadísticas | ✅ | ✅ | ✅ |
| Subir fotos | ✅ | ✅ | ✅ |
| **Conectar cuentas de Wallapop** | ❌ | ✅ | ✅ |
| **Publicar anuncios en Wallapop** | ❌ | ✅ | ✅ |
| **Mejorar fotos con IA** | ❌ | ❌ | ✅ |

Con los bloques 1-3 la aplicación ya es útil de verdad: el cliente prepara todo
el trabajo y publica copiando y pegando en Wallapop. El bloque 4 sólo quita ese
último paso manual.
