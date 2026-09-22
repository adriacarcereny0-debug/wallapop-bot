# Wallapop Assistant — sistema de diseño

## Escena

Un vendedor profesional revisando anuncios y mensajes a media mañana, en un
portátil, con luz de ventana, alternando entre esta pantalla y la app de
Wallapop en el móvil. Lectura sostenida, mucha tabla, mucho número.

→ **Tema claro como principal**, con modo oscuro completo para quien trabaje de
noche. Ninguno de los dos es el «de por defecto»: ambos están diseñados.

## Estrategia de color

**Restrained** (la propia del registro *product*): neutros entintados más un
acento que no pasa del 10 % de la superficie.

El acento es una **terracota cálida**, no el verde azulado de Wallapop ni el
azul corporativo de SaaS. Es una decisión deliberada contra el reflejo de
categoría: el panel debe poder distinguirse de la propia plataforma que
gestiona, para que el usuario nunca confunda «mi herramienta» con «Wallapop».

Todos los colores en OKLCH. Ni `#000` ni `#fff`: los neutros van entintados
hacia el tono cálido del acento (croma 0.004–0.012).

| Rol | Claro | Oscuro |
|---|---|---|
| Fondo | `oklch(0.985 0.004 70)` | `oklch(0.165 0.008 60)` |
| Superficie | `oklch(1 0 0 / 0.7)` sobre fondo | `oklch(0.205 0.009 60)` |
| Texto | `oklch(0.24 0.012 55)` | `oklch(0.94 0.006 70)` |
| Texto tenue | `oklch(0.52 0.012 55)` | `oklch(0.68 0.008 65)` |
| Acento | `oklch(0.52 0.132 42)` | `oklch(0.66 0.125 45)` |
| Borde | `oklch(0.90 0.006 65)` | `oklch(0.28 0.010 60)` |

Semánticos (independientes del acento, sólo para estado):
éxito `oklch(0.55 0.11 150)`, aviso `oklch(0.68 0.13 75)`,
error `oklch(0.55 0.16 25)`, informativo `oklch(0.55 0.08 240)`.

## Tipografía

Pila del sistema, sin fuentes web: una herramienta interna no debe esperar a
descargar tipografías.

Escala con ratio ≥ 1.25 — `0.75 / 0.8125 / 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.25 rem`.
Jerarquía por **escala y peso**, no por color.

Los números van en `font-variant-numeric: tabular-nums`: en una tabla de precios
las columnas tienen que alinearse.

Longitud de línea máxima en texto corrido: 68ch.

## Espaciado y ritmo

Base de 4px. El ritmo **varía**: la cabecera respira (24px), las filas de tabla
aprietan (10px vertical). Un padding uniforme en todo sería monotonía.

## Componentes

- **Tarjetas**: sólo cuando el contenido es una unidad con la que se interactúa
  (una cuenta, un anuncio). Nunca tarjetas dentro de tarjetas.
- **Tablas**: la forma principal de listar. Cabecera pegajosa, filas altas
  pulsables, números a la derecha.
- **Estados**: pastillas de texto con fondo tenue del color semántico. **Nunca
  barras laterales de color** en tarjetas o filas.
- **Vacíos**: explican qué es la sección y ofrecen la acción siguiente. Nunca un
  dibujo con «No hay nada aquí».
- **Esqueletos**: bloques con la forma real del contenido que va a llegar.

## Movimiento

Sólo donde aclara: apertura de paneles y cambios de estado. `ease-out-quart`
(`cubic-bezier(0.25, 1, 0.5, 1)`), 120–220 ms. Nunca rebotes. Nunca animar
propiedades de layout. Se respeta `prefers-reduced-motion`.

## Prohibiciones

Bordes laterales de color, texto con degradado, glassmorphism decorativo,
plantilla de métrica-héroe con degradado, rejillas de tarjetas idénticas,
modales como primera opción, y guiones largos en el texto.
