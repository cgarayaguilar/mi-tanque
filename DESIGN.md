# DESIGN.md — Design system de Mi tanque

> **Fuente canónica del sistema visual** (ENGINEERING_PRINCIPLES.md §14.3). La UI consume estos
> tokens, nunca valores sueltos (§8.13). Si cambia este archivo, cambia `src/theme/tokens.ts`, y
> viceversa.
>
> **Base:** el sistema de ElevenLabs, instalado con `npx getdesign add elevenlabs` (getdesign
> 0.6.25). El original se conserva sin modificar en
> [`docs/design/elevenlabs.md`](docs/design/elevenlabs.md). Este archivo lo adapta a Mi tanque: una
> PWA de una columna que se usa con una mano junto al tanque, con modo claro y oscuro. Cada
> desviación del original está marcada como **Adaptación**.
>
> **Implementación:** `src/theme/tokens.ts` → theme de MUI (`src/theme/muiTheme.ts`) y theme heredado
> de styled-components (`src/store/initialState.js`, con `src/styles/type.js` para la tipografía),
> mientras conviven (ADR 0001).

## Principios

- **Editorial y sereno.** Fondo blanco roto, tinta casi negra y pesos tipográficos contenidos. La
  marca se nota en la tipografía y la atmósfera, no en el color.
- **Un solo color de acción: la tinta.** Los botones principales son píldoras de tinta. No hay
  acento saturado.
- **Los pasteles son atmósfera.** Solo como orbes radiales decorativos (detrás del medidor). Nunca
  rellenos, texto, datos ni fondos de componentes.
- **Línea fina + una sombra suave.** Las tarjetas se separan del fondo con 1px de `hairline`; la
  sombra suave aparece solo al pasar el cursor.
- **Píldora para acciones; radios suaves para tarjetas.**

## Color

### Tokens

| Token           | Claro (por defecto) | Oscuro            | Uso                                                                 |
| --------------- | ------------------- | ----------------- | ------------------------------------------------------------------- |
| `canvas`        | `#f5f5f5`           | `#0c0a09`         | Fondo de la app                                                     |
| `surface`       | `#ffffff`           | `#1c1917`         | Tarjetas, diálogos, campos, barra de navegación                     |
| `surfaceStrong` | `#f0efed`           | `#292524`         | Badges, pestaña activa, pista del medidor y de las barras           |
| `hairline`      | `#e7e5e4`           | `#292524`         | Divisores y contorno de tarjetas (decorativo)                       |
| `controlBorder` | `#8f8984`           | `#78716c`         | Borde que identifica un control (campos, botón de contorno)         |
| `ink`           | `#0c0a09`           | `#ffffff`         | Títulos y texto principal                                           |
| `body`          | `#4e4e4e`           | `#d6d3d1`         | Texto corrido                                                       |
| `muted`         | `#6b655e`           | `#a8a29e`         | Etiquetas, metadatos, texto secundario                              |
| `disabled`      | `#a8a29e`           | `#57534e`         | Texto y controles deshabilitados                                    |
| `primary`       | `#292524`           | `#fafafa`         | Píldora de acción, estados activos, datos (ola, barras de progreso) |
| `primaryActive` | `#0c0a09`           | `#e7e5e4`         | Presión y hover de la píldora                                       |
| `onPrimary`     | `#ffffff`           | `#0c0a09`         | Texto sobre `primary`                                               |
| `error`         | `#b91c1c`           | `#f87171`         | Errores                                                             |
| `success`       | `#15803d`           | `#4ade80`         | Confirmaciones                                                      |
| `overlay`       | `rgba(12,10,9,0.4)` | `rgba(0,0,0,0.6)` | Fondo de diálogos                                                   |
| `gradientMint`  | `#a7e5d3`           | `#a7e5d3`         | Solo orbes atmosféricos                                             |
| `gradientSky`   | `#a8c8e8`           | `#a8c8e8`         | Solo orbes atmosféricos                                             |

**Adaptación — modo oscuro.** El original solo define bandas oscuras de marketing. El modo oscuro
de la app se deriva de esos tokens (`canvas-deep`, `surface-dark-elevated`, `on-dark`) y de la
misma escala de grises cálidos (stone) en la que se basa el sistema. La píldora se invierte: blanca
con texto en tinta. El modo claro es el predeterminado.

**Adaptación — contraste (WCAG AA, §8.11).** Los valores del original que no llegan a AA como texto
de interfaz o borde de control se oscurecieron un paso dentro de la misma familia:

| Token           | Original  | Proyecto  | Peor caso (original → proyecto)      |
| --------------- | --------- | --------- | ------------------------------------ |
| `muted`         | `#777169` | `#6b655e` | 4.20 → 5.01 (sobre `surfaceStrong`)  |
| `error`         | `#dc2626` | `#b91c1c` | 4.20 → 5.63                          |
| `success`       | `#16a34a` | `#15803d` | 3.02 → 4.60 (sobre `canvas`)         |
| `controlBorder` | `#d6d3d1` | `#8f8984` | 1.49 → 3.01 (1.4.11, borde de campo) |

Todos los pares texto/fondo de la tabla de tokens cumplen AA (≥ 4.5:1) en ambos modos, y `primary`
como gráfico cumple 3:1 sobre cualquier superficie. `success` como texto va sobre `canvas` o
`surface`, no sobre `surfaceStrong` (4.36).

## Tipografía

| Familia               | Uso                                                        |
| --------------------- | ---------------------------------------------------------- |
| **Newsreader** 300    | Display: títulos de sección y de diálogo, nombre de la app |
| **Inter** 400/500/600 | Todo lo demás                                              |

**Adaptación — fuente display.** Waldenburg es de pago. El sustituto que propone el original, EB
Garamond, no existe en peso 300 en Google Fonts; Newsreader sí, y es una serif editorial moderna.

| Token              | Fuente     | Tamaño | Peso | Interlineado | Tracking | Uso en la app                                     |
| ------------------ | ---------- | ------ | ---- | ------------ | -------- | ------------------------------------------------- |
| `displayMd`        | Newsreader | 32     | 300  | 1.13         | -0.32    | Títulos grandes (MUI `h1`/`h2`)                   |
| `displaySm`        | Newsreader | 24     | 300  | 1.2          | 0        | Nombre de la app, títulos de sección y de diálogo |
| `titleMd`          | Inter      | 20     | 500  | 1.35         | 0        | Títulos de componente (MUI `h6`)                  |
| `titleSm`          | Inter      | 18     | 500  | 1.44         | 0.18     | Títulos de tarjeta                                |
| `bodyMd`           | Inter      | 16     | 400  | 1.5          | 0.16     | Texto base, campos                                |
| `bodyStrong`       | Inter      | 16     | 500  | 1.5          | 0.16     | Etiquetas de campo, capacidad en el diagrama      |
| `bodySm`           | Inter      | 15     | 400  | 1.47         | 0.15     | Mensajes y texto de apoyo                         |
| `caption`          | Inter      | 14     | 400  | 1.5          | 0        | Detalles de tarjeta, fechas, metadatos            |
| `captionUppercase` | Inter      | 12     | 600  | 1.4          | 0.96     | Etiquetas de cifras ("GALONES"), badges, cotas    |
| `button`           | Inter      | 15     | 500  | 1            | 0        | Botones, pestañas, links                          |
| `figureLg`         | Inter      | 32     | 600  | 1.1          | -0.32    | Galones del medidor                               |
| `figureMd`         | Inter      | 20     | 600  | 1.35         | 0        | Cifras de resultados                              |
| `figureSm`         | Inter      | 16     | 600  | 1.5          | 0        | Cifras del resumen y de cada medición             |

- El display nunca va en negrita: 300 es la firma del sistema, para títulos.
- **Adaptación — cifras.** Los datos (pulgadas, galones, litros) usan Inter 600 con dígitos
  tabulares (`font-variant-numeric: tabular-nums`): en serif 300 eran demasiado finos para leerse
  de un vistazo junto al tanque, y los dígitos de igual ancho alinean las columnas.
- El cuerpo nunca baja a 300.

## Espaciado, radios y elevación

**Espaciado** (base 4px; MUI `theme.spacing(1) = 4px`): `xxs` 4 · `xs` 8 · `sm` 12 · `base` 16 ·
`md` 20 · `lg` 24 · `xl` 32 · `xxl` 48. El padding de pantalla es `base`.

**Radios:** `xs` 4 · `sm` 6 · `md` 8 (campos) · `lg` 12 (tarjetas compactas) · `xl` 16 (tarjetas
destacadas, diálogos, pastilla del medidor) · `xxl` 24 · `pill` (botones, badges, navegación).

**Elevación:** plano + `hairline`. Única sombra: `0 4px 16px rgba(0,0,0,0.04)`, solo en hover de
tarjetas.

## Layout

- Una columna de ancho máximo **600px**, centrada (**Adaptación:** el original es una web de
  1200px).
- Barra superior de **64px**.
- Rejilla de tanques: columnas automáticas de mínimo 250px.
- Medidor de **250px**.

## Componentes

| Componente                 | Especificación                                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Botón primario**         | Píldora `primary` / `onPrimary`, `button`, alto **40px** · hover y presión `primaryActive` · deshabilitado `surfaceStrong` / `disabled` · muestra "Guardando…" mientras envía (§8.6). **Adaptación:** las acciones principales de ancho completo ("Calcular", "Guardar") miden **48px** (`size="large"`) porque se usan con una mano junto al tanque  |
| **Botón de contorno**      | Píldora transparente, texto `ink`, borde 1px `controlBorder`                                                                                                                                                                                                                                                                                          |
| **Botón de texto**         | Texto `ink` subrayado, sin fondo                                                                                                                                                                                                                                                                                                                      |
| **Campo de texto**         | Fondo `surface`, texto `bodyMd` en `ink`, alto **44px**, radio `md`, borde 1px `controlBorder`; con foco el borde pasa a **2px `ink`** · etiqueta `bodyStrong` · placeholder `muted`                                                                                                                                                                  |
| **Tarjeta de tanque**      | Botón con fondo `surface`, 1px `hairline`, radio `lg`, padding `sm`, sombra suave en hover · título `titleSm`, detalles `caption`, CTA como texto subrayado                                                                                                                                                                                           |
| **Resumen de galones**     | `feature-card`: fondo `surface`, 1px `hairline`, radio `xl`, padding `lg` · etiquetas `captionUppercase`, cifras `figureSm`                                                                                                                                                                                                                           |
| **Medición del historial** | Tarjeta compacta (`surface`, `hairline`, radio `lg`) · barra de llenado de 4px en `primary` sobre `surfaceStrong`                                                                                                                                                                                                                                     |
| **Fila de tanque**         | `voice-row`: botón de ancho completo con divisor `hairline`, `aria-expanded`                                                                                                                                                                                                                                                                          |
| **Barra de navegación**    | Píldora `surface` con 1px `hairline`; pestañas de 48px · activa: `surfaceStrong` + `ink`; inactiva: `muted`                                                                                                                                                                                                                                           |
| **Stepper**                | Badge circular de 24px: completado `primary`/`onPrimary`, pendiente `surfaceStrong`/`muted` · línea 1px `hairline`                                                                                                                                                                                                                                    |
| **Diagrama de tanque**     | Cilindro en `ink` (SVG `currentColor`), cotas y flechas en `muted`, números `captionUppercase`                                                                                                                                                                                                                                                        |
| **Medidor**                | Círculo de 250px en `surfaceStrong` con 1px `hairline`; ola en `primary`; cifras en una pastilla `surface` (radio `xl`) encima de la ola para leerse a cualquier nivel; galones en `figureLg` · **orbe atmosférico** detrás: un círculo propio cuyo degradado (`gradientSky` → `gradientMint`) se desvanece dentro de él (`closest-side`), sin bordes |
| **Diálogo** (MUI)          | Papel `surface`, radio `xl`, 1px `hairline` · título `displaySm` · acciones: `Cancelar` (texto) + principal (píldora) · pantalla completa en teléfonos · único tipo de modal (§8.8)                                                                                                                                                                   |
| **Calendario**             | Dentro del diálogo: sigue los tokens (`surface`, `ink`, `muted`, `disabled`); rango en píldora `primary` con números `onPrimary`                                                                                                                                                                                                                      |
| **Toast** (Sileo)          | Único canal de avisos (§8.8). Tema `light` en modo claro y `dark` en modo oscuro · títulos en mayúscula inicial · descripción del toast claro con 8.6:1                                                                                                                                                                                               |
| **Barra superior**         | `top-nav`: fondo `canvas`, 64px · logo (`currentColor`) + nombre en `displaySm` · botón de tema de MUI                                                                                                                                                                                                                                                |

### Estados de toast

| Estado    | Uso                                                                      |
| --------- | ------------------------------------------------------------------------ |
| `success` | Una mutación salió bien; la app quedó lista sin conexión                 |
| `error`   | Una operación falló (guardar, cargar)                                    |
| `warning` | Un dato ingresado no es válido o ya existe                               |
| `action`  | Aviso que requiere una acción, con botón (nueva versión); no expira solo |

## Foco, movimiento e iconos

- **Foco:** todo control muestra el foco del teclado con un contorno de **2px en `primary`** y 2px
  de separación (`focusRing` en los tokens; `src/styles/interactive.js` en el código heredado;
  `MuiButtonBase` en MUI).
- **Movimiento:** transiciones de 150ms en controles; llenado del medidor de 3s. Con
  `prefers-reduced-motion` la ola no se anima.
- **Iconos:** `@mui/icons-material` para código nuevo; `react-icons` hasta migrar cada pantalla.
  Interactivos con `aria-label`, decorativos con `aria-hidden`.

## Icono de la app y colores de la PWA

- Icono: logo en blanco sobre `primary` claro (`#292524`), generado desde `public/pwa-icon.svg`.
- `theme_color` y `background_color` del manifest: `canvas` claro. La app sincroniza el
  `theme-color` con el modo al arrancar.

## Colores fuera de los tokens (§8.13)

Ninguno en el código: ESLint rechaza cualquier color hex fuera de `src/theme/tokens.ts`. Solo hay
dos excepciones, porque no pueden leer los tokens:

- El SVG fuente del icono (`public/pwa-icon.svg`).
- El `theme-color` inicial de `index.html`.

## Hacer y no hacer

- **Sí:** píldora `primary` para la acción principal; Newsreader 300 en títulos; Inter con tracking
  ligero en el cuerpo; orbes pastel solo como atmósfera; tokens en todo.
- **No:** un color de acción saturado; display en negrita; pasteles como relleno, texto o datos;
  esquinas rectas en botones; valores sueltos.
