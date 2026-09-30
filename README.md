# Mi tanque

App para medir el nivel de combustible de un tanque a partir de las pulgadas medidas.

Construida con React + [Vite](https://vite.dev/). Los datos se guardan localmente en el
navegador (IndexedDB vía Dexie).

## Requisitos

- Node.js `^20.19.0` o `>=22.12.0`

## Scripts

| Comando           | Descripción                                               |
| ----------------- | --------------------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo en http://localhost:3000           |
| `npm run build`   | Build de producción en `build/`                           |
| `npm run preview` | Sirve localmente el build de producción                   |
| `npm test`        | Tests con Vitest (modo watch; `npx vitest run` una vez)   |

## Imports absolutos

Las carpetas de primer nivel de `src/` (`components`, `hooks`, `pages`, `services`, `store`,
`styles`, `utils`, `assets`) se importan sin ruta relativa, p. ej.
`import Button from 'components/Button'`. Los alias están definidos en `vite.config.mjs`.

## SVG como componentes

Se usa `vite-plugin-svgr`: `import Logo from 'assets/logo.svg?react'`.

## PWA

La app es instalable y funciona sin conexión gracias a
[vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (config en `vite.config.mjs`).

- **Service worker**: precachea todo el build y cachea Google Fonts. Solo se genera en el build
  (`npm run build && npm run preview`), no en `npm run dev`.
- **Actualizaciones**: cuando se publica una versión nueva, la app pregunta si se quiere
  actualizar (`src/registerServiceWorker.js`).
- **Iconos**: se generan a partir de `public/pwa-icon.svg` con `npm run generate-pwa-assets`
  (config en `pwa-assets.config.mjs`).
- **Instalar en el teléfono**: requiere HTTPS, así que hay que abrir la app desplegada (no la IP
  local). En Android, Chrome ofrece "Instalar app"; en iPhone, Safari → Compartir →
  "Agregar a inicio".
