# Guía de operación

## Poner el sistema en producción

Recorre los cuatro escenarios **en orden**. Wallapop no tiene entorno de
pruebas: cuando llegues al cuarto, cada llamada afecta a tu cuenta real.

### 1. Demo (0 €)

```bash
cp .env.example .env.local
npm install && npm run dev
```

Recorre las nueve secciones. Genera un anuncio, pide una respuesta, revisa el
optimizador. Todo funciona sin servicios externos.

### 2. IA real

```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-…
```

Vuelve a generar un anuncio y **comprueba la pantalla de procedencia**: lo que
no facilitaste debe aparecer en «Información que falta», no inventado.

### 3. Base de datos real

Sigue [`SUPABASE.md`](SUPABASE.md) y pon `DATA_MODE=supabase`. Verifica RLS
(§3 de ese documento) antes de meter datos.

### 4. Integración con Wallapop

Sólo cuando 1–3 funcionen. Lee
[`WALLAPOP_INTEGRATION.md`](WALLAPOP_INTEGRATION.md) entero, contrasta los
endpoints con el portal oficial y entonces:

```bash
WALLAPOP_INTEGRATION_ENABLED=true
WALLAPOP_CLIENT_ID=…
WALLAPOP_CLIENT_SECRET=…
WALLAPOP_REDIRECT_URI=https://tu-dominio/api/wallapop/oauth/callback
TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
```

Empieza con **una sola cuenta** y una operación de lectura (`GET /items`) antes
de escribir nada.

---

## Añadir una cuenta de Wallapop

### En modo demo

*Cuentas → Añadir cuenta*. Se crea una cuenta ficticia con datos de ejemplo,
etiquetada como demo. No toca nada externo.

### Con la integración activa

1. *Cuentas → Conectar con Wallapop*.
2. Se abre el autorizador de Wallapop (OAuth + PKCE). Inicia sesión **con la
   cuenta que quieras conectar**.
3. Acepta los permisos. Wallapop devuelve un código.
4. La aplicación lo canjea por tokens, los cifra y los guarda.
5. La cuenta aparece como **Conectada**.

Repite para cada cuenta. **Una sola credencial de aplicación sirve para todas**:
los tokens son por usuario. Es el modelo oficial, no un rodeo.

### Cosas que conviene saber

- **La contraseña de Wallapop nunca se introduce en esta aplicación.** Si alguna
  pantalla te la pidiera, algo va mal: no la escribas.
- Los refresh tokens **rotan**: cada renovación devuelve uno nuevo y el anterior
  deja de valer. La aplicación lo gestiona, pero si restauras una copia de
  seguridad antigua de la base de datos, las cuentas tendrán que reconectarse.
- `activate` e `inactivate` requieren **Wallapop Pro**. Sin él, esas acciones
  fallarán con error de permisos.

---

## Incidencias frecuentes

### Una cuenta pasa a «Requiere atención»

Causas habituales, por orden de probabilidad:

1. **Refresh token caducado o invalidado.** → Reconecta la cuenta.
2. **Límite de publicación alcanzado.** Wallapop crea los anuncios nuevos como
   inactivos **sin avisar**. → Consulta `GET /items/limits` y libera plazas
   marcando como vendido, borrando o desactivando.
3. **Wallapop Pro caducado.** → `activate`/`inactivate` dejan de funcionar.

### `429` en los endpoints de IA

Has superado el límite por minuto. Espera lo que indique la cabecera
`Retry-After`. Si ocurre de forma habitual con uso normal, sube el límite en la
ruta correspondiente de `src/app/api/ai/`.

### La IA devuelve un error de validación

El modelo ha devuelto algo que no cumple el esquema. Suele pasar con modelos
pequeños y esquemas complejos. Prueba con un modelo mayor, o revisa el esquema
en `src/lib/ai/types.ts`.

### El webhook rechaza las entregas

- La firma se calcula sobre el cuerpo **en crudo**. Si algún proxy lo reformatea,
  la firma deja de coincidir.
- Hay una ventana de 5 minutos: si el reloj del servidor va desfasado, las
  entregas se rechazan como caducadas.
- El token debe ser el devuelto al **crear** el webhook, no el `client_secret`,
  si registraste el webhook con un token propio.

### «Configuración de entorno inválida» al arrancar

El mensaje indica exactamente qué falta. Es intencionado: es mejor no arrancar
que fallar a mitad de la petición de un usuario.

---

## Mantenimiento periódico

| Frecuencia | Tarea |
|---|---|
| Semanal | Revisar la sección Cuentas: nada debería estar en «Requiere atención» |
| Semanal | Revisar «Anuncios que requieren revisión» |
| Mensual | Consultar `ai_generations` y comprobar el gasto de IA |
| Mensual | Copia de seguridad: `npx supabase db dump -f copia-$(date +%F).sql` |
| Trimestral | `npm outdated` y actualizar dependencias |
| Trimestral | **Revisar la documentación oficial de Wallapop por si la API ha cambiado.** No hay versionado: los cambios se anuncian en su página de *Updates* |

El último punto importa: las especificaciones están en `0.0.1` y **no hay
versionado formal**. Una ruptura no avisada es un riesgo real, y por eso el
cliente falla de forma explícita en vez de intentar adivinar.
