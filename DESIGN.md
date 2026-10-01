# DESIGN.md — Design system de Mi tanque

> **Fuente canónica del sistema visual** (ENGINEERING_PRINCIPLES.md §14.3). La UI consume estos
> tokens, nunca valores sueltos (§8.13). Si cambia este archivo, cambia el theme, y viceversa: van
> **en sincronía**.
>
> **Implementación actual:** theme de styled-components en `src/store/initialState.js`
> (`darkTheme` / `lightTheme`). **Implementación objetivo:** theme de MUI derivado de este archivo
> (sección "Mapeo al theme de MUI"), según el plan del
> [ADR 0001](docs/adr/0001-adopt-engineering-principles.md).

## Principios visuales

- **Mobile-first, una columna.** La app se usa con una mano, junto al tanque. El contenido se
  centra con un ancho máximo de 600px.
- **Plano, sin sombras.** La jerarquía se da con el color de superficie (fondo → tarjeta), no con
  elevación.
- **Un solo color de acento** (cian) para acciones, progreso y nivel de combustible. Todo lo
  interactivo o "lleno" es cian; el resto es neutro.
- **Modo oscuro por defecto**, con modo claro disponible desde la barra superior.

## Color

### Tokens

| Token           | Modo oscuro (por defecto) | Modo claro             | Uso                                                                        |
| --------------- | ------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `background`    | `#142850`                 | `#FFFFFF`              | Fondo de la app                                                            |
| `surface`       | `#27496D`                 | `#E1E1E1`              | Tarjetas, campos, barra de navegación, medidor                             |
| `accent`        | `#00A8CC`                 | `#00A8CC`              | Botones, links, pasos completados, nivel de combustible, barra de progreso |
| `onAccent`      | `#FFFFFF`                 | `#FFFFFF`              | Texto sobre `accent` (botón relleno)                                       |
| `textPrimary`   | `#FFFFFF`                 | `#142850`              | Títulos, valores, etiquetas de campos                                      |
| `textSecondary` | `rgba(255,255,255,0.57)`  | `rgba(39,73,109,0.54)` | Texto de apoyo, captions, bordes de campos, pasos pendientes               |
| `error`         | `#B00020`                 | `#B00020`              | Errores                                                                    |
| `overlay`       | `rgba(0,0,0,0.5)`         | `rgba(0,0,0,0.5)`      | Fondo de modales                                                           |

**Marca** (fuera del theme): azul `#142850` y cian `#00A8CC`. Se usan en el icono de la app
(`public/pwa-icon.svg`), el `theme_color` del manifest y el logo (`src/assets/logo.svg`).

### Contraste (WCAG 2.1 AA) — ⚠️ hay incumplimientos

AA exige **4.5:1** para texto normal y **3:1** para texto grande (≥ 24px, o ≥ 18.66px en negrita) y
componentes de interfaz.

| Combinación                       | Oscuro: fondo                                 | Oscuro: tarjeta | Claro: fondo | Claro: tarjeta |
| --------------------------------- | --------------------------------------------- | --------------- | ------------ | -------------- |
| `textPrimary`                     | 14.49 ✅                                      | 9.29 ✅         | 14.49 ✅     | 11.08 ✅       |
| `textSecondary`                   | 5.71 ✅                                       | **4.24 ❌**     | **2.79 ❌**  | **2.54 ❌**    |
| `accent` como texto               | 5.16 ✅                                       | **3.31 ❌**     | **2.81 ❌**  | **2.15 ❌**    |
| `error` como texto                | **1.98 ❌**                                   | **1.27 ❌**     | 7.33 ✅      | 5.60 ✅        |
| `onAccent` sobre `accent` (botón) | **2.81 ❌** (también falla como texto grande) |                 |              |                |

**Corrección propuesta** (calculada; pendiente de aprobación porque cambia el aspecto visual):

| Token                                         | Cambio propuesto                                               | Resultado                                                   |
| --------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| `accentText` (nuevo, solo para texto y links) | Oscuro `#4FD0EB` · Claro `#00677F`                             | Oscuro 7.97 / 5.11 ✅ · Claro 6.47 / 4.95 ✅                |
| `accent`                                      | Se mantiene `#00A8CC` para rellenos, iconos y el medidor       | —                                                           |
| `onAccent`                                    | `#142850` en lugar de blanco                                   | 5.16 ✅                                                     |
| `textSecondary`                               | Oscuro `rgba(255,255,255,0.70)` · Claro `rgba(39,73,109,0.85)` | Oscuro 5.48 en tarjeta ✅ · Claro 6.14 / 5.00 ✅            |
| `error` (modo oscuro)                         | `#FF8A80`                                                      | 6.35 sobre fondo ✅ (4.07 sobre tarjeta: solo texto grande) |

## Tipografía

**Familia:** Roboto (Google Fonts, pesos 400, 500 y 700), con `sans-serif` como respaldo.

| Variante         | Elemento | Tamaño | Peso   | Color                                  |
| ---------------- | -------- | ------ | ------ | -------------------------------------- |
| `title`          | `h1`     | 28px   | 500    | `textPrimary`                          |
| `title2`         | `h2`     | 20px   | 500    | `textPrimary`                          |
| `title3`         | `h3`     | 16px   | 700    | `textPrimary`                          |
| `link`           | `h3`     | 16px   | 700    | `accent`, subrayado al pasar el cursor |
| `link2`          | `h4`     | 14px   | 700    | `accent`, subrayado al pasar el cursor |
| `body`           | `p`      | 14px   | 400    | `textSecondary`                        |
| `caption`        | `span`   | 12px   | 400    | `textSecondary`                        |
| `caption2`       | `span`   | 10px   | 300 ⚠️ | `accent`                               |
| `label` (campos) | `label`  | 16px   | 700    | `textPrimary`                          |

⚠️ `caption2` usa peso 300, que **no se carga** desde Google Fonts: el navegador lo sintetiza. Al
migrar, pasa a 400 o se añade el peso 300 a la carga de fuentes.

⚠️ Hoy los links (`link`, `link2`) son encabezados (`h3`/`h4`) con `onClick`: no son navegables con
teclado. Al migrar pasan a `<Link>`/`<Button>` de MUI (§8.11).

## Espaciado

Base de **8px** con medio paso de 4px. MUI: `theme.spacing(1) = 8px`.

| Token | Valor | `theme.spacing()` |
| ----- | ----- | ----------------- |
| `xs`  | 4px   | `0.5`             |
| `sm`  | 8px   | `1`               |
| `md`  | 16px  | `2`               |
| `lg`  | 24px  | `3`               |
| `xl`  | 32px  | `4`               |

Valores fuera de la escala en el código actual (3px, 5px, 20px, 25px) se redondean al token más
cercano al migrar cada componente. El padding estándar de pantalla y de tarjeta es `md` (16px).

## Radios y sombras

| Token        | Valor   | Uso                                                      |
| ------------ | ------- | -------------------------------------------------------- |
| `radius`     | 8px     | Tarjetas, campos, botones, barra de navegación           |
| `radiusFull` | 50%     | Badges del stepper, medidor circular del tanque          |
| Sombras      | Ninguna | Diseño plano: MUI `elevation` 0 en todos los componentes |

## Layout y breakpoints

- **Contenedor:** ancho máximo 600px, centrado (`body`). En MUI: `<Container maxWidth={false}
sx={{ maxWidth: 600 }}>` en la raíz.
- **Pantallas con navegación inferior** (Medición, Historial): columna de alto completo; la barra de
  navegación se empuja al fondo.
- **Rejilla de tanques:** columnas automáticas de mínimo 250px (`repeat(auto-fit, minmax(250px,
1fr))`): 1 columna en teléfonos estrechos, 2 a partir de ~516px.
- **Breakpoints de MUI:** los de por defecto; con el ancho máximo de 600px, en la práctica solo
  importan `xs` y `sm`.

## Movimiento

| Token              | Valor                                     | Uso                                       |
| ------------------ | ----------------------------------------- | ----------------------------------------- |
| `durationShort`    | 250ms                                     | Transiciones de botón y de borde de campo |
| `durationCollapse` | 300ms                                     | Abrir/cerrar el historial de un tanque    |
| `durationFill`     | 3s, `cubic-bezier(0.39, 0.575, 0.565, 1)` | Animación de llenado del medidor          |
| Press              | `scale(0.95)`                             | Feedback táctil al pulsar un botón        |

Respeta `prefers-reduced-motion`: el llenado del medidor se muestra sin animación cuando el usuario
lo pide (pendiente: hoy no se respeta).

## Iconografía

Hoy se usan cuatro familias de `react-icons` (Font Awesome, Material, BoxIcons, Ionicons). Al
migrar se unifican en **`@mui/icons-material`** (imports con nombre, tree-shaking), con estos
equivalentes de significado:

| Uso                 | Actual                            | Objetivo                    |
| ------------------- | --------------------------------- | --------------------------- |
| Modo claro / oscuro | `FaSun` / `FaMoon`                | `LightMode` / `DarkMode`    |
| Historial           | `MdHistory`                       | `History`                   |
| Medición            | `BiTachometer`                    | `Speed`                     |
| Fecha / ubicación   | `IoMdCalendar` / `IoMdPin`        | `CalendarMonth` / `Place`   |
| Buscar              | `MdSearch`                        | `Search`                    |
| Expandir / contraer | `IoIosArrowDown` / `IoIosArrowUp` | `ExpandMore` / `ExpandLess` |

Todo icono interactivo lleva `aria-label`.

## Componentes base

| Componente             | Variantes y estados                                                                                                                                                                                                       | Notas                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Button**             | `filled` (fondo `accent`), `outlined` (borde `accent`), `link` (texto `accent`) · tamaños `small` 14/700, `medium` 16/700, `large` 20/500 · alto 48px · ancho completo · `active`: escala 0.95 · `hover`: velo oscuro 20% | Falta estado `disabled` + spinner de envío (§8.6)                                                                   |
| **TextField**          | Etiqueta opcional, icono de búsqueda opcional · borde `textSecondary`, en foco `textPrimary` · fondo `surface`                                                                                                            | ⚠️ El área táctil del input (~35px) es menor que los 48px recomendados. Faltan error inline y texto de ayuda (§8.7) |
| **Card**               | Fondo `surface`, radio 8px, padding 8–16px                                                                                                                                                                                | Tarjeta de tanque y de medición                                                                                     |
| **AppBar**             | Logo + nombre a la izquierda, cambio de tema a la derecha                                                                                                                                                                 | Alto ~49px                                                                                                          |
| **NavBar**             | Dos pestañas (Historial, Medición) con icono + texto · activa en `accent`                                                                                                                                                 | Fija al fondo de la pantalla                                                                                        |
| **Stepper**            | Badge circular de 20px · completado `accent`, pendiente `textSecondary` · línea vertical de 1px                                                                                                                           | Formulario de medición en 3 pasos                                                                                   |
| **Diagrama de tanque** | Cilindro con capacidad al centro y cotas de diámetro y longitud                                                                                                                                                           | SVG (`src/assets/tank.svg`)                                                                                         |
| **Medidor**            | Círculo de 250px en `surface` con ola animada `accent` (`react-wavify`) que sube hasta el % de llenado                                                                                                                    | Muestra % y galones encima                                                                                          |
| **Modal**              | Overlay `overlay` a pantalla completa                                                                                                                                                                                     | Selector de rango de fechas                                                                                         |

## Mapeo al theme de MUI (objetivo)

```ts
// src/theme.ts — se crea en la fase de migración a MUI (ADR 0001)
palette: {
  mode: 'dark' | 'light',
  primary:    { main: accent, contrastText: onAccent },
  background: { default: background, paper: surface },
  text:       { primary: textPrimary, secondary: textSecondary },
  error:      { main: error },
},
typography: { fontFamily: "'Roboto', sans-serif", /* variantes de la tabla de tipografía */ },
spacing: 8,
shape: { borderRadius: 8 },
components: { MuiPaper: { defaultProps: { elevation: 0 } } /* diseño plano */ },
```

## Valores hardcodeados pendientes de eliminar (§8.13)

| Archivo                                  | Valor                                                          | Token que lo sustituye          |
| ---------------------------------------- | -------------------------------------------------------------- | ------------------------------- |
| `src/components/AppBar/index.jsx`        | `#fff` / `#142850`                                             | `textPrimary`                   |
| `src/components/CardHistory/index.jsx`   | `#00A8CC`                                                      | `accent`                        |
| `src/components/DateModal/index.jsx`     | `#00A8CC` (×2)                                                 | `accent`                        |
| `src/components/TankAnimation/index.jsx` | `#00A8CC`                                                      | `accent`                        |
| `src/utils/alerts.js`                    | `#00A8CC`                                                      | `accent` (desaparece con Sileo) |
| `src/components/TankAnimation/styles.js` | `theme.textSecondary` (no existe: debería ser `secondaryText`) | `textSecondary`                 |
