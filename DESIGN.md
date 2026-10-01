# DESIGN.md — Design system de Solo Camioneros

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
> **Implementación:** `src/theme/tokens.ts` → theme de MUI (`src/theme/muiTheme.ts`); los estilos
> globales salen del theme con `CssBaseline` y `GlobalStyles` (`src/App.tsx`).

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
| `differenceInk` | `#ffffff`           | `#ffffff`         | Texto sobre la ola del medidor, con `mix-blend-mode: difference`    |
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
| `figureMd`         | Inter      | 20     | 600  | 1.35         | 0        | Cifras de resultados, galones del medidor         |
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
- Barra superior de **64px**. En teléfonos el logo baja a 52px y el nombre a `titleSm` (18px, fuente
  display) para caber en una línea junto a los botones de tema y de sesión, hasta 360px.
- Rejilla de tanques: columnas automáticas de mínimo 150px (dos por fila en un teléfono).
- Medidor de **200px**: Medición entera cabe en una pantalla de teléfono (812px).
- Barra de navegación **fija abajo** en Medición, Historial y Flota (esta última solo con sesión, con tres pestañas); los toasts quedan por encima de ella.

## Componentes

| Componente                   | Especificación                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Botón primario**           | Píldora `primary` / `onPrimary`, `button`, alto **40px** · hover y presión `primaryActive` · deshabilitado `surfaceStrong` / `disabled` · muestra "Guardando…" mientras envía (§8.6). **Adaptación:** las acciones principales de ancho completo ("Calcular", "Guardar") miden **48px** (`size="large"`) porque se usan con una mano junto al tanque                                                                                                                                                                                                                     |
| **Botón de contorno**        | Píldora transparente, texto `ink`, borde 1px `controlBorder`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Botón de texto**           | Texto `ink` subrayado, sin fondo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Campo de texto**           | Fondo `surface`, texto `bodyMd` en `ink`, alto **44px**, radio `md`, borde 1px `controlBorder`; con foco el borde pasa a **2px `ink`** · etiqueta `bodyStrong` · placeholder `muted` · campos numéricos: `inputMode="decimal"` (teclado decimal), aceptan coma o punto (`parseDecimal`) y se validan con Sileo, nunca con la burbuja del navegador (`noValidate`)                                                                                                                                                                                                        |
| **Tarjeta de tanque**        | `TankCard`: mosaico con fondo `surface`, 1px `hairline`, radio `lg` · capacidad en `figureMd` `ink`, medidas en `caption` `muted` · el tanque en uso lleva borde de 2px `ink`, ícono de check y `aria-current` · sombra suave en hover                                                                                                                                                                                                                                                                                                                                   |
| **Resumen del tanque**       | Fila de Medición: fondo `surface`, 1px `hairline`, radio `lg` · "Tu tanque" en `captionUppercase`, capacidad `titleSm`, medidas `caption` · botón de contorno "Cambiar"                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Historial de un tanque**   | `TankHistoryCard`: `feature-card` (fondo `surface`, 1px `hairline`, radio `xl`, padding `base`) · diagrama + título `titleSm` + número de mediciones · cifras "Al inicio / Al final / Diferencia" con `Stat` pequeño (`figureSm`) · botón de contorno de ancho completo con `aria-expanded` que muestra las mediciones                                                                                                                                                                                                                                                   |
| **Medición del historial**   | `MeasurementCard`: tres líneas separadas por `hairline` · fecha `caption` `muted` y porcentaje a la derecha · galones `figureSm` + litros y pulgadas en `caption` · barra de llenado de 4px en `primary` sobre `surfaceStrong` con `aria-label` · lugar con ícono de 14px                                                                                                                                                                                                                                                                                                |
| **Barra de navegación**      | `NavBar`: fija abajo (`sticky`, fondo `canvas`, con el margen seguro del teléfono) · píldora `surface` con 1px `hairline`; enlaces de 48px con ícono de 20px · activo (según la ruta, `aria-current="page"`): `surfaceStrong` + `ink`; inactivo: `muted`                                                                                                                                                                                                                                                                                                                 |
| **Diagrama de tanque**       | Cilindro en `ink` (SVG `currentColor`), cotas y flechas en `muted`, números `captionUppercase`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Medidor**                  | Círculo de 200px en `surfaceStrong` con 1px `hairline`; ola en `primary` · cifras **sin contenedor**, centradas en el círculo (icono 16px, porcentaje `captionUppercase`, galones `figureMd`), en `differenceInk` con `mix-blend-mode: difference`: se invierten contra la pista o la ola (oscuras sobre lo claro, blancas sobre la tinta) a cualquier nivel y en ambos modos, verificado al 4%, 52%, 72% y 100% · **orbe atmosférico** detrás: un círculo propio cuyo degradado (`gradientSky` → `gradientMint`) se desvanece dentro de él (`closest-side`), sin bordes |
| **Diálogo** (MUI)            | Papel `surface`, radio `xl`, 1px `hairline` · título `displaySm` · acciones: `Cancelar` (texto) + principal (píldora) · pantalla completa en teléfonos · único tipo de modal (§8.8)                                                                                                                                                                                                                                                                                                                                                                                      |
| **Calendario**               | Dentro del diálogo: sigue los tokens (`surface`, `ink`, `muted`, `disabled`); rango en píldora `primary` con números `onPrimary`                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Toast** (Sileo)            | Único canal de avisos (§8.8). Tema `light` en modo claro y `dark` en modo oscuro · títulos en mayúscula inicial · descripción del toast claro con 8.6:1                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Barra superior**           | `top-nav`: fondo `canvas`, 64px · logo (`currentColor`) + nombre en `displaySm` · botón de tema de MUI                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Estado vacío**             | `EmptyState`: icono en un círculo `surfaceStrong`, título `displaySm`, texto `bodyMd` (máx. 36ch), botón primario · para pantallas sin datos o con un paso previo pendiente (§8.2, §8.4)                                                                                                                                                                                                                                                                                                                                                                                 |
| **Cifra con etiqueta**       | `Stat`: etiqueta `captionUppercase` en `muted`, valor `figureMd` (o `figureSm`), nota opcional `caption` · "—" cuando aún no hay dato                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Campo numérico**           | `NumberField`: campo de texto con `inputMode="decimal"` (acepta "12.5" y "1,500"; si el teclado solo tiene coma, "12,5" se lee como 12.5), etiqueta visible, unidad corta al final (`gal.`, `pulg.`) en `muted` y una línea debajo que muestra la pista o el error (§8.7)                                                                                                                                                                                                                                                                                                |
| **Carga de lista**           | `Skeleton` redondeado de MUI con la altura de la tarjeta (radio `lg`), en `surfaceStrong` · la lista lleva `aria-busy`                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Búsqueda**                 | Campo de texto `type="search"` con icono de lupa en `muted` al inicio · contador de resultados `caption` en `muted` con `role="status"`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Campo de selección**       | `SelectField`: `NativeSelect` de MUI con la misma caja que el campo de texto (44px, `controlBorder`) · en el teléfono abre el selector del sistema · etiqueta `bodyStrong` y una línea de ayuda o error                                                                                                                                                                                                                                                                                                                                                                  |
| **Control de sesión**        | Sin sesión: botón de texto "Entrar" en la barra superior. Con sesión: avatar de 32px (`primary` / `onPrimary`, inicial en `bodyStrong`) que abre un menú de MUI con "Mi cuenta" y "Cerrar sesión" · mientras se restaura: círculo `Skeleton`                                                                                                                                                                                                                                                                                                                             |
| **Sección de cuenta**        | Tarjeta `surface` con 1px `hairline`, radio `xl`, padding `base` · título `titleSm` · formularios con botón de contorno "Guardar" deshabilitado hasta que haya cambios · rol en un `Chip` pequeño                                                                                                                                                                                                                                                                                                                                                                        |
| **Separador con texto**      | `Divider` de MUI con texto `caption` `muted` ("o con tu teléfono")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Tarjeta de flota**         | Fila de ancho completo: `surface`, 1px `hairline`, radio `lg`, padding `sm`/`base` · a la izquierda el punto de color (camión, remolque) o el icono de forma (tanque) · título `titleSm` y hasta dos líneas `caption` `muted` en una sola línea cada una · `Chip` "Archivado" y opacidad 0,7 si está archivada                                                                                                                                                                                                                                                           |
| **Punto de color**           | `ColorDot`: círculo de 16–20px con el color del vehículo (`vehicleSwatches` en los tokens: datos, no tema) y anillo `muted`; vacío para "otro" o sin color (el nombre se escribe al lado)                                                                                                                                                                                                                                                                                                                                                                                |
| **Campo de color**           | `ColorField`: `Chip` por color con su punto, en un `radiogroup`; el elegido en `primary`; "Otro" abre un campo de texto                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Icono de forma de tanque** | `TankShapeIcon`: la sección del tanque vista de frente (círculo, rectángulo, "D" con lado plano, "D" con fondo plano) en trazo de 3px `ink`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Foto**                     | `PhotoField`: imagen 4:3 con radio `lg` y 1px `hairline` · botón de contorno "Agregar foto"/"Cambiar foto", deshabilitado sin conexión con su explicación en `caption`                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Pestañas de sección**      | `Tabs` de MUI a ancho completo bajo el título, con indicador `ink` y separador `hairline`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### Estados de toast

| Estado    | Uso                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------- |
| `success` | Una mutación salió bien; la app quedó lista sin conexión                                             |
| `error`   | Una operación falló (guardar, cargar)                                                                |
| `warning` | Algo salió a medias y conviene saberlo (los errores de un campo van junto al campo)                  |
| `action`  | Aviso con botón, siempre expandido: nueva versión (no expira solo), tanque repetido ("Usarlo", 10 s) |

## Foco, movimiento e iconos

- **Foco:** todo control muestra el foco del teclado con un contorno de **2px en `primary`** y 2px
  de separación (`focusRing` en los tokens, aplicado en `MuiButtonBase`).
- **Movimiento:** transiciones de 150ms en controles; llenado del medidor de 3s. Con
  `prefers-reduced-motion` la ola no se anima.
- **Iconos:** `@mui/icons-material`.
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
