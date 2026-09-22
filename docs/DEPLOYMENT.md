# Despliegue

## GitHub

```bash
git add .
git commit -m "Wallapop Assistant"
git push -u origin main
```

`.gitignore` excluye `.env*`. **Comprueba antes de cada push que no subes
secretos:**

```bash
git grep -nE "sk-ant-|eyJhbGciOi|service_role" -- ':!*.md' ':!.env.example'
```

Si ese comando devuelve algo, no hagas push: has filtrado una clave.

Para una herramienta privada, el repositorio debe ser **privado**.

---

## Vercel

### 1. Importar

En [vercel.com](https://vercel.com) → *Add New Project* → importa el repositorio.
Vercel detecta Next.js solo. No cambies nada:

- Framework: Next.js
- Build: `npm run build`
- Output: `.next`

### 2. Variables de entorno

En *Settings → Environment Variables*, añade las de
[`ENVIRONMENT.md`](ENVIRONMENT.md) para **Production** y **Preview**:

```
DATA_MODE=supabase
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=…
WALLAPOP_INTEGRATION_ENABLED=false
```

> Empieza con la integración **desactivada**, aunque tengas credenciales.
> Verifica primero que todo lo demás funciona: Wallapop no tiene sandbox y
> cualquier error se comete sobre datos reales.

### 3. Desplegar

Vercel despliega en cada push a `main` y crea una previsualización por cada pull
request.

### 4. Dominio propio

*Settings → Domains*. Al añadirlo, actualiza `NEXT_PUBLIC_APP_URL` y, si la
integración está activa, `WALLAPOP_REDIRECT_URI` (debe coincidir exactamente con
la registrada en Wallapop).

---

## Lista de comprobación previa a producción

**Seguridad**

- [ ] Repositorio privado
- [ ] Ninguna clave en el código (comprobado con el `git grep` de arriba)
- [ ] RLS verificado en las trece tablas ([`SUPABASE.md`](SUPABASE.md) §3)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` sin prefijo `NEXT_PUBLIC_`
- [ ] `TOKEN_ENCRYPTION_KEY` generada con `openssl rand -base64 32` y guardada aparte
- [ ] Registro abierto desactivado si es una herramienta privada

**Funcionamiento**

- [ ] `npm run verify` pasa en local
- [ ] Recorrido completo de la interfaz en `DATA_MODE=supabase`
- [ ] Sin errores en la consola del navegador
- [ ] Revisado en móvil

**Wallapop (sólo al activar la integración)**

- [ ] Endpoints contrastados con developers.wallapop.com
- [ ] `WALLAPOP_REDIRECT_URI` idéntica a la registrada
- [ ] Primera cuenta conectada y verificada con una operación de lectura
- [ ] Webhook registrado y firma verificada

---

## Costes

| Servicio | Plan gratuito | Cuándo hay que pagar |
|---|---|---|
| **GitHub** | Repositorios privados ilimitados | Casi nunca |
| **Vercel Hobby** | 100 GB de ancho de banda, dominio propio | Uso comercial intenso → Pro, 20 $/mes |
| **Supabase Free** | 500 MB de BD, 1 GB de almacenamiento | Se pausa tras 7 días inactivo → Pro, 25 $/mes |
| **API de IA** | — | **Coste variable. El único que crece con el uso** |
| **Almacenamiento de imágenes** | 1 GB en Supabase | Catálogos grandes |

**Empezar sale a 0 €** salvo la IA.

### Controlar el gasto de IA

Es el único coste que escala, así que el proyecto lo acota por tres vías:

1. **`AI_PROVIDER=demo`** durante el desarrollo: coste cero.
2. **Límite de peticiones** por usuario en cada endpoint de IA (15–20 por
   minuto), que corta bucles accidentales.
3. **Registro de consumo**: la tabla `ai_generations` guarda tokens y coste de
   cada llamada, para saber exactamente en qué se va el dinero.

Orden de magnitud con Claude Sonnet: generar un anuncio ronda los 2 000 tokens
de entrada y 800 de salida, unos **0,018 €** por anuncio. Mil anuncios al mes
son unos 18 €. Un modelo más pequeño (Haiku) lo reduce a un tercio.

> **Limitación conocida del límite de peticiones:** es en memoria, por instancia.
> En serverless, el límite efectivo se multiplica por el número de instancias
> activas. Frena bucles accidentales, que es su objetivo, pero no es una defensa
> estricta. Para eso hace falta un almacén compartido (Upstash Redis tiene plan
> gratuito y encaja bien con Vercel).
