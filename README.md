# Mi tanque

App para medir el nivel de combustible de un tanque a partir de las pulgadas medidas. Es una PWA:
se instala en el teléfono y funciona sin conexión.

- **Producción:** https://mi-tanque.vercel.app
- **Stack actual:** React + [Vite](https://vite.dev/); datos guardados localmente en el navegador
  (IndexedDB vía Dexie). El stack objetivo y la migración están en el
  [ADR 0001](docs/adr/0001-adopt-engineering-principles.md).

## Reglas del proyecto

Antes de cambiar código, lee:

- [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md): principios de ingeniería y Definición
  de Terminado. Es el contrato del equipo.
- [`DESIGN.md`](DESIGN.md): design system (colores, tipografía, espaciado, componentes).
- [`AGENTS.md`](AGENTS.md): instrucciones para asistentes de IA (`CLAUDE.md` lo importa).
- [`docs/adr/`](docs/adr/): decisiones de arquitectura.

## Requisitos

- Node.js 22 (el mismo que usan Vercel y la CI)

## Arrancar

```bash
npm install
npm run dev
```

La app queda en http://localhost:3000. `npm install` también instala el hook de pre-commit.

## Scripts

| Comando             | Descripción                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo en http://localhost:3000                  |
| `npm run build`     | Build de producción en `build/`                                  |
| `npm run preview`   | Sirve localmente el build de producción                          |
| `npm test`          | Tests con Vitest (modo watch; `npx vitest run` una vez)          |
| `npm run typecheck` | Chequeo de tipos con TypeScript (`tsc --noEmit`)                 |
| `npm run lint`      | ESLint                                                           |
| `npm run format`    | Formatea todo con Prettier                                       |
| `npm run check`     | Tipos + lint + formato + tests: tiene que pasar antes de mergear |

## Calidad automática

- **Pre-commit** (husky + lint-staged): ESLint y Prettier sobre los archivos del commit.
- **CI** (`.github/workflows/ci.yml`): tipos, lint, formato, tests y build en cada push a `main` y
  en cada pull request.
- **TypeScript estricto** (`tsconfig.json`): el código nuevo se escribe en TS; el JS heredado
  compila mientras se migra.
- `git blame` ignora los commits de formato masivo listados en `.git-blame-ignore-revs`. Para
  activarlo en tu clon: `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

## Deploy

- **Vercel**, conectado a GitHub: cada push a `main` despliega a producción y cada rama genera una
  URL de preview. La configuración está en `vercel.json`.
- **Rollback:** en el panel de Vercel, promover el deploy anterior a producción.

## Imports absolutos

Las carpetas de primer nivel de `src/` (`components`, `hooks`, `pages`, `services`, `store`,
`styles`, `utils`, `assets`) se importan sin ruta relativa, p. ej.
`import Button from 'components/Button'`. Los alias están definidos en `tsconfig.json` y en
`vite.config.mjs`.

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
