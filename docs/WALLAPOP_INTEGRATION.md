# Integración con Wallapop — análisis previo al desarrollo

> **Este documento es el punto de partida obligatorio del proyecto.** Se redactó *antes* de
> escribir una sola línea de integración, tal y como exige el encargo. Define qué puede hacer
> la aplicación de forma oficial y autorizada, y qué **no** puede hacer.

---

## 0. Procedencia de esta información y su fiabilidad

| Dato | Valor |
|---|---|
| Fecha del análisis | 2026-09-22 |
| Portal oficial | `https://developers.wallapop.com` |
| Acceso directo al portal | **Bloqueado** por la política de egreso de red del entorno de desarrollo |
| Fuente utilizada | Copia pública de las especificaciones OpenAPI originales de Wallapop, publicadas por API Evangelist (`github.com/api-evangelist/wallapop`, directorio `openapi/_original/`) |
| Copia local en este repositorio | `reference/wallapop-openapi/` |

### ⚠️ Advertencia de verificación — léase antes de conectar nada

No he podido abrir `developers.wallapop.com` desde este entorno: el proxy de red lo bloquea.
Todo lo que sigue procede de una **réplica de terceros** de las especificaciones OpenAPI que
Wallapop publica de forma abierta. Las especificaciones son las originales (`Items Connect API`,
`Transactions Connect API`, `Webhooks Connect API`, versión `0.0.1`), pero son una copia
fechada el **2026-07-21**, no la fuente viva.

**Consecuencia práctica:** ninguna afirmación de este documento debe darse por buena en
producción hasta contrastarla con el portal oficial y con el contrato de integrador que firme
el cliente. Por ese motivo la integración se entrega **desactivada por defecto** mediante
`WALLAPOP_INTEGRATION_ENABLED=false` (ver `docs/ENVIRONMENT.md`). La aplicación es 100 %
funcional sin ella gracias al modo demo.

Ninguna parte de este análisis se obtuvo inspeccionando la app, interceptando tráfico ni
usando credenciales. Todo es documentación pública de Wallapop.

---

## 1. Respuesta corta

**Sí, Wallapop tiene una API oficial: Wallapop Connect.** Está dirigida a *vendedores
profesionales* e *integradores autorizados*, y cubre **anuncios, envíos/transacciones y
webhooks**.

**No cubre mensajería.** No existe ningún endpoint oficial para leer o enviar mensajes de
chat. Esta es la limitación más importante del proyecto y condiciona por completo el diseño
de la sección de Conversaciones.

---

## 2. Superficie oficial disponible

- **Base URL:** `https://connect.wallapop.com`
- **Autenticación:** OAuth 2.0 *Authorization Code* + **PKCE (S256)** sobre Keycloak
  (realm `wallapop-connect` en `iam.wallapop.com`). Bearer token en cada petición.
- **Modelo de credenciales:** **una** credencial de aplicación (`client_id` + `client_secret`)
  por integrador, y **un par de tokens por usuario/cuenta**. → *Esto es exactamente lo que
  necesita el requisito multicuenta, y lo hace de forma oficial.*
- **Refresh:** `grant_type=refresh_token` devuelve **access token y refresh token nuevos**.
  Hay que guardar el nuevo refresh token y descartar el anterior (rotación obligatoria).
- **Cabecera `User-Agent` válida:** requerida en el endpoint de token.

### 2.1 Items Connect API — gestión de anuncios

| Operación | Método y ruta |
|---|---|
| Crear y publicar anuncio | `POST /items` |
| Listar anuncios | `GET /items` |
| Detalle de anuncio | `GET /items/{itemId}` |
| Modificar anuncio | `PUT /items/{itemId}` |
| Eliminar anuncio | `DELETE /items/{itemId}` |
| Añadir imagen | `POST /items/{itemId}/images` |
| Eliminar imagen | `DELETE /items/{itemId}/images/{imageId}` |
| Marcar como vendido | `PUT /items/{id}/sold` |
| Activar anuncio inactivo | `PUT /items/{id}/activate` |
| Desactivar anuncio | `PUT /items/{id}/inactivate` |
| Reservar / cancelar reserva | `PUT /items/{id}/reserve` · `PUT /items/{id}/unreserve` |
| Listar categorías | `GET /items/categories` |
| Atributos de una categoría | `GET /items/categories/{id}/attributes` |
| **Límites de publicación del usuario** | `GET /items/limits` |
| Listar anuncios inactivos | `GET /items/inactive` |

Campos obligatorios al crear (`Item`): `category_leaf_id`, `title`, `description`, `price`
(+ `main_image` en el `CreateItemRequest`). Opcionales: `attributes`, `hashtags`, `delivery`, `stock`.

Campo clave para sincronizar catálogo: **`attributes.external_id`** = el SKU interno del
vendedor. Está disponible en todas las categorías y es el anclaje entre nuestro catálogo y
el de Wallapop.

### 2.2 Transactions Connect API — envíos y post-venta

`GET /transactions/requests/pending`, `GET /transactions/requests/{requestId}`,
`POST .../accept/home-pickup`, `POST .../accept/post-office`, `GET /transactions/pending`,
`GET /transactions/{transactionId}`, `POST /transactions/{transactionId}/delivery/register`,
`GET /disputes/{disputeId}`, `PATCH /deliveries/{deliveryId}/status`.

Las operaciones de aceptación requieren un `transaction_id` generado por el cliente, que actúa
como clave de deduplicación (no hay `Idempotency-Key` general en la API).

### 2.3 Webhooks Connect API — notificaciones de eventos

Gestión: `POST /webhooks`, `GET /webhooks`, `PUT /webhooks/{id}`, `DELETE /webhooks/{id}`,
`PATCH /webhooks/{id}/token`.

Firma de entrega: cabeceras `X-Wallapop-Signature` y `X-Wallapop-Timestamp`.
Esquema **HMAC-SHA256 sobre `"payload:timestamp"`** usando el token devuelto al crear el
webhook. El timestamp cambia en cada petición para impedir *replay*.

Eventos publicados:

- **Anuncio:** `ITEM_LISTED`, `ITEM_INACTIVATED`, `ITEM_BANNED`, `ITEM_OUT_OF_STOCK`,
  `ITEM_RETURNED`, `SALE_COMPLETED`
- **Envío:** `DELIVERY_REQUEST_STARTED` / `_CANCELLED` / `_FAILED` / `_EXPIRED`
- **Transacción:** `TRANSACTION_CREATED`
- **Disputa:** `DISPUTE_CREATED`, `DISPUTE_QUALITY_CHECK_STARTED` / `_EXPIRED` /
  `_APPROVED_BY_SELLER`, `DISPUTE_ISSUE_REPORTED_BY_SELLER`, `DISPUTE_CANCELLED_BY_WALLAPOP`
- **Chat:** `CHAT_LEAD_CREATED` — *sólo avisa de que un comprador ha iniciado un chat.
  No entrega el contenido del mensaje.*

### 2.4 Límites y condiciones operativas

| Concepto | Valor documentado |
|---|---|
| Límite global | **36 peticiones/segundo por vendedor profesional** |
| Endpoint de token (`authorization_code`) | 174 peticiones / 5 min por IP de origen |
| Endpoint de token (`refresh_token`) | 174 peticiones / 5 min por IP de origen |
| Paginación | Cursor: `since` + `metadata.pagination.next`, **40 elementos/página** |
| Idempotencia general | **No documentada** |
| Versionado | Ninguno (specs en `0.0.1`); los cambios se anuncian en la página *Updates* |
| **Entorno de pruebas** | **No existe sandbox. Las pruebas se hacen en producción.** |

El último punto es crítico y justifica por sí solo la arquitectura elegida: **el modo demo no
es un adorno, es la red de seguridad**. Todo se prueba contra datos ficticios antes de tocar
producción, porque *no hay otro sitio donde probar*.

---

## 3. Qué NO existe y, por tanto, NO se implementa

| # | Petición del cliente | Realidad oficial | Qué se entrega en su lugar |
|---|---|---|---|
| 1 | **Gestionar mensajes de compradores** | **No hay API de mensajería.** Sólo el webhook `CHAT_LEAD_CREATED`, que notifica la existencia de un chat sin su contenido. | Modo asistente: el usuario pega o registra la conversación, la IA analiza y **propone** respuesta, el usuario la revisa, copia y envía **manualmente** en Wallapop. |
| 2 | **Enviar respuestas automáticamente** | Imposible sin API de chat. | Botones `Editar` / `Regenerar` / `Copiar`. **No existe botón de envío automático** y no se ha programado ninguna vía alternativa. |
| 3 | **Aceptar ofertas / negociar automáticamente** | No hay endpoint de ofertas ni de chat. | Asistente de negociación: calcula contraofertas contra objetivo/mínimo y **recomienda**. La decisión y la ejecución son humanas. |
| 4 | **Rotación / republicación masiva para ganar visibilidad** | **No existe endpoint de *bump*, *renew* ni republicación.** Sólo `activate` / `inactivate` contra `GET /items/limits`, y `inactivate`/`activate` requieren **Wallapop Pro**. | Planificador "Anuncios que requieren revisión": detecta anuncios antiguos, incompletos o con datos mejorables y **prepara** la modificación para aprobación humana. Nunca republica en bucle. |
| 5 | **Más visualizaciones** | No hay API de métricas de visualizaciones, y manipularlas estaría prohibido. | Optimizador de calidad del anuncio: puntúa título, descripción, fotos e información y da recomendaciones concretas. **Sin promesas de visitas ni de ventas.** |
| 6 | **Duplicar el mismo producto en varias cuentas** | La API lo permitiría técnicamente, pero publicar el mismo artículo en varias cuentas para ocupar más espacio puede constituir uso abusivo. | La app **avisa** cuando un producto ya está publicado en otra cuenta y exige confirmación explícita. No hay duplicado masivo automático. |
| 7 | Estadísticas de rendimiento por anuncio | No hay API de analítica. | Sólo se registran métricas propias: anuncios, estados, ventas registradas por el usuario, actividad y consumo de IA. Se distingue siempre el dato propio del dato de plataforma. |

### Lo que Wallapop tendría que ofrecer para automatizar lo anterior

1. Una **Messaging/Chat Connect API** con lectura de conversaciones y envío de mensajes bajo
   consentimiento del vendedor.
2. Una **Offers API** para recibir y responder ofertas económicas.
3. Endpoints de **analítica por anuncio** (impresiones, favoritos, conversión).
4. Un endpoint explícito de **renovación/reposicionamiento** con su propia cuota, que
   sustituyese a la republicación manual.
5. Un **entorno sandbox**, para no tener que validar integraciones en producción.

Mientras no existan, estas funciones se quedan en modo asistido. **No se han sustituido por
scraping, automatización de navegador, resolución de CAPTCHA, suplantación de huella, rotación
de proxies ni creación automática de cuentas.**

---

## 4. Elegibilidad y pasos para activar la integración real

1. Disponer de **cuenta de vendedor profesional** en Wallapop (y **Wallapop Pro** para
   `activate`/`inactivate`, `stock` y `show_discount`).
2. Solicitar a Wallapop el alta como **aplicación integradora** y obtener `client_id` +
   `client_secret`.
3. Registrar la `redirect_uri` de esta aplicación
   (`https://<tu-dominio>/api/wallapop/oauth/callback`).
4. Contrastar cada endpoint de este documento con el portal oficial vigente.
5. Rellenar las variables de entorno y poner `WALLAPOP_INTEGRATION_ENABLED=true`.
6. Conectar la primera cuenta desde *Cuentas → Conectar con Wallapop*.

Hasta el paso 5 la aplicación funciona íntegramente en **modo demo**.

---

## 5. Mapa de capacidades implementado en código

La tabla anterior no vive sólo en este documento: está codificada en
`src/lib/wallapop/capabilities.ts` como única fuente de verdad. La interfaz consulta ese mapa
para decidir si una acción se ofrece, se ofrece con confirmación o se explica como no
disponible. Añadir una capacidad nueva exige tocar ese fichero, lo que obliga a justificar
cada automatización.
