# Funciones: lo implementado y lo que no puede implementarse

Lista explícita, punto por punto, de lo que pidió el cliente.

---

## ✅ Implementado

| Petición | Estado |
|---|---|
| Crear/preparar anuncios | Generador con IA + pantalla de revisión obligatoria |
| Generar títulos y descripciones con IA | `generateListing` / `improveListing`, con separación de procedencia |
| Optimizar anuncios | `optimizeListing`: puntúa título, descripción, fotos e información y da recomendaciones concretas |
| Modificar anuncios | Edición en la aplicación; envío a Wallapop mediante `PUT /items/{itemId}` cuando la integración está activa |
| Gestionar varias cuentas desde un panel | Arquitectura multicuenta completa, con filtro global y aislamiento de datos |
| Gestionar mensajes de compradores | **En modo asistente** (ver limitaciones) |
| Generar respuestas con IA | `generateReply` con botones Editar / Regenerar / Copiar |
| Ayudar en la negociación | `negotiate`: contraofertas contra objetivo y mínimo, nunca por debajo del mínimo |
| Gestionar catálogo/productos | Catálogo central con SKU, precios, características, stock y notas internas |
| Estadísticas y control de actividad | Panel con cifras propias, registro de actividad y trazabilidad de IA |
| Evitar acciones que provoquen bloqueos | Mapa de capacidades que impide ejecutar lo no autorizado; límite de 36 req/s respetado |
| Modo demo completo | Toda la aplicación funciona sin servicios externos |
| Base de datos preparada | Esquema PostgreSQL con RLS en todas las tablas |
| Seguridad | Auth, RLS, validación, límite de peticiones, cifrado de tokens, cabeceras |
| Preparado para GitHub y Vercel | README, `.env.example`, `.gitignore`, documentación completa |

### Funciones de IA disponibles

`generateListing` · `improveListing` · `optimizeListing` · `generateReply` ·
`analyzeConversation` · `negotiate` · `analyzeProduct` · `generateImagePrompt`

---

## ⚠️ Implementado parcialmente

### Generación y mejora de imágenes

**Implementado:** la capa de decisión. `generateImagePrompt` construye el prompt
de edición y **rechaza** las peticiones que falsearían el producto (borrar
arañazos, añadir accesorios, cambiar el color, simular otro modelo). Hay tests
que lo verifican.

**Pendiente:** conectar un proveedor de imágenes real (`IMAGE_PROVIDER` admite
`openai` y `gemini`, hoy en `demo`) y el almacenamiento en object storage. El
esquema ya contempla `product_images` con `url`, `kind` y `transformation`, y
guarda URLs, nunca binarios.

**Motivo:** requiere elegir proveedor y bucket, que son decisiones de coste del
cliente. La lógica de veracidad, que es la parte delicada, ya está hecha.

### Rotación de anuncios

**Implementado:** el planificador. La sección «Anuncios que requieren revisión»
detecta anuncios antiguos, incompletos o mejorables y prepara la modificación.
El cliente de la API incluye `activate`, `inactivate` y `GET /items/limits`.

**No implementado:** republicación o renovación masiva. **No existe endpoint
para ello** — ver más abajo.

---

## ❌ No puede implementarse como se pidió

### 1. Leer y enviar mensajes de compradores automáticamente

- **Qué quería el cliente:** que la aplicación leyera las conversaciones de
  Wallapop y enviara respuestas por sí sola.
- **Por qué no se puede:** Wallapop **no publica ninguna API de mensajería**. La
  Connect API cubre anuncios, transacciones y webhooks. El único evento
  relacionado con el chat es `CHAT_LEAD_CREATED`, que avisa de que un comprador
  ha abierto una conversación **sin entregar su contenido**.
- **Alternativa entregada:** modo asistente. Registras la conversación, la IA la
  analiza y redacta un borrador, tú lo editas y lo copias, y lo envías desde
  Wallapop. La interfaz **no tiene botón de enviar**, para que no quede duda.
- **Qué haría falta:** que Wallapop publicase una *Messaging Connect API* con
  lectura y envío bajo consentimiento del vendedor.

### 2. Aceptar o rechazar ofertas automáticamente

- **Qué quería el cliente:** cerrar ventas sin intervención.
- **Por qué no se puede:** no hay API de ofertas ni de chat. Las ofertas viajan
  por el chat, que no es accesible.
- **Alternativa entregada:** el asistente calcula contraofertas contra el
  objetivo y el mínimo, marca las ofertas por debajo del mínimo y **nunca**
  ofrece aceptarlas. La decisión es humana.
- **Qué haría falta:** una *Offers API* con operaciones de aceptar, rechazar y
  contraofertar.

### 3. Rotación / republicación masiva para ganar visibilidad

- **Qué quería el cliente:** rotar anuncios para aparecer más arriba.
- **Por qué no se puede:** **no existe endpoint de republicación, renovación ni
  «bump»**. Lo único disponible es activar/desactivar contra el límite de plazas
  de la suscripción, y eso **requiere Wallapop Pro**. Republicar en bucle
  borrando y recreando anuncios sería un uso abusivo.
- **Alternativa entregada:** planificador de revisión que detecta qué anuncios
  conviene mejorar y prepara la modificación.
- **Qué haría falta:** un endpoint de renovación con su propia cuota.

### 4. Garantizar más visualizaciones

- **Qué quería el cliente:** más visitas en los anuncios.
- **Por qué no se puede:** nadie puede garantizar visitas, y generar
  visualizaciones o interacciones falsas está prohibido y sería detectable.
  Wallapop tampoco expone métricas de visualizaciones por API.
- **Alternativa entregada:** optimizador de calidad del anuncio, con puntuación
  y recomendaciones concretas. La interfaz dice explícitamente que la puntuación
  **no predice visitas ni ventas**.
- **Qué haría falta:** endpoints de analítica por anuncio.

### 5. Duplicar el mismo producto en varias cuentas

- **Por qué no se hace automáticamente:** publicar el mismo artículo en varias
  cuentas para ocupar más espacio puede constituir uso abusivo.
- **Alternativa entregada:** el catálogo es central y puedes publicar en la
  cuenta que elijas, de una en una y de forma consciente. No hay duplicado
  masivo.

### 6. Crear cuentas automáticamente

- **Por qué no se hace:** incumple las condiciones de uso. No se ha escrito
  código para ello.
- **Alternativa:** crea las cuentas manualmente y conéctalas por OAuth.

---

## 🚫 Técnicas descartadas por política

No hay código en este repositorio para ninguna de estas:

- Scraping del sitio o de la app
- Automatización de navegador para saltar restricciones
- Resolución de CAPTCHA
- Evasión de sistemas anti-bot
- Suplantación de huella digital (*fingerprint spoofing*)
- Rotación de IP o proxies para evitar detección
- Evasión de límites de cuenta o de publicación
- Creación automática de cuentas
- Extracción masiva de datos
- Generación de visualizaciones o interacciones falsas

Puedes comprobarlo: no hay dependencias de automatización de navegador en
`package.json` (Playwright se usó sólo durante el desarrollo para verificar el
diseño y no forma parte del producto), y todas las llamadas salientes pasan por
`src/lib/wallapop/client.ts`, que sólo conoce endpoints oficiales y comprueba
cada operación contra `src/lib/wallapop/capabilities.ts`.
