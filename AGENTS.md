# AGENTS.md — Mi tanque (frontend)

Instrucciones para asistentes de IA. `CLAUDE.md` importa este archivo: edita solo este.

## Lee primero — son obligatorios

1. [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md): el contrato del equipo. Todo cambio
   cumple su Definición de Terminado o documenta la excepción (ADR o comentario en el código).
2. [`DESIGN.md`](DESIGN.md): tokens y componentes. Nunca escribas colores, espaciados ni tamaños de
   fuente sueltos.
3. [`docs/adr/0001-adopt-engineering-principles.md`](docs/adr/0001-adopt-engineering-principles.md):
   qué es heredado, qué es objetivo y las fases de migración. Revísalo antes de tocar código
   heredado.

## Qué es

Una PWA para medir el nivel de combustible de tanques cilíndricos horizontales. El usuario elige un
tanque, ingresa las pulgadas medidas y obtiene galones y litros. Cada medición se guarda con fecha y
ubicación y se muestra en un historial. Se instala en el teléfono y funciona sin conexión.

- Producción: https://mi-tanque.vercel.app (proyecto de Vercel `mi-tanque`). **Un push a `main`
  despliega a producción**; las demás ramas generan URLs de preview. Nunca hagas push a `main` sin
  la autorización explícita del dueño en la conversación.
- El backend (Firebase Cloud Functions + Firestore) vivirá en un repo hermano; todavía no existe.

## Stack: heredado vs. objetivo

| Área        | Heredado (no extender)                                  | Objetivo (todo código nuevo)                                                 |
| ----------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Lenguaje    | JavaScript (`.js`/`.jsx`)                               | TypeScript estricto (`.ts`/`.tsx`)                                           |
| React       | 17                                                      | 19 (fase 1 del ADR 0001)                                                     |
| UI          | styled-components, theme en `src/store/initialState.js` | MUI con theme derivado de `DESIGN.md`                                        |
| Estado      | Context + `useLocalStorage`                             | Stores de Zustand por dominio, con selectores                                |
| Datos       | IndexedDB vía Dexie (`src/services`)                    | Firestore, filtrado por `accountId`                                          |
| Feedback    | sweetalert2 (`src/utils/alerts.js`)                     | Toasts de Sileo; `<Dialog>` de MUI solo para confirmar acciones destructivas |
| Formularios | `FormData` + validación manual                          | React Hook Form + Zod (`zodResolver`)                                        |
| Iconos      | `react-icons`                                           | `@mui/icons-material`                                                        |

No agregues código nuevo sobre el stack heredado. Si un cambio modifica de forma sustancial un
archivo heredado, migra ese archivo (o su pantalla completa) al stack objetivo en el mismo cambio,
como indica el ADR 0001.

## Comandos

```bash
npm run dev            # servidor de desarrollo en http://localhost:3000 (sin service worker)
npm run build          # build de producción en build/
npm run preview        # sirve el build (con service worker)
npm test               # Vitest en modo watch; `npx vitest run` lo corre una vez
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
npm run format         # Prettier --write
npm run check          # typecheck + lint + formato + tests (lo mismo que la CI, sin el build)
```

`npm run check` tiene que pasar antes de cada commit. El hook de pre-commit (husky + lint-staged)
corre lint y formato sobre los archivos preparados; la CI (`.github/workflows/ci.yml`) corre todo
en cada push y PR.

## Convenciones

- **Imports absolutos** desde las carpetas de primer nivel de `src/`:
  `import Button from 'components/Button'`. Los alias están en `tsconfig.json` (`paths`) y en
  `vite.config.mjs`: mantenlos sincronizados.
- **SVG como componentes:** `import Logo from 'assets/logo.svg?react'`.
- **Idioma:** código, identificadores, comentarios y logs en inglés; texto de cara al usuario en
  español, con la voz de `ENGINEERING_PRINCIPLES.md` §9 (tú, español neutro).
- **Commits:** Conventional Commits, un cambio lógico por commit, en una rama (nunca directo en
  `main`). Los commits de formato masivo se registran en `.git-blame-ignore-revs`.
- **Tests:** toda corrección de bug lleva su test de regresión. Los tests que tocan IndexedDB usan
  `fake-indexeddb` (configurado en `src/setupTests.js`) y vacían las tablas en `beforeEach`.
- **El cálculo de combustible** vive solo en `src/utils/calcFuelLevel.js` y
  `src/utils/converts.js`, fijado por tests de caracterización. No lo dupliques.

## Lo no obvio

- Los datos viven en el IndexedDB del navegador **por origen**: cambiar el dominio de producción
  hace perder las mediciones de los usuarios. `localhost` y `127.0.0.1` son orígenes distintos, útil
  para probar con la base vacía.
- El service worker solo existe en el build de producción: prueba el comportamiento de PWA con
  `npm run build && npm run preview`. Tras un deploy, las apps instaladas muestran el aviso de nueva
  versión.
- `typescript` está fijado en `~6.0` porque `typescript-eslint` todavía no soporta la 7.
- Si `npm install` falla con `EACCES` en `~/.npm`, la caché global de npm del usuario tiene
  problemas de permisos: usa `--cache <directorio temporal>` en vez de cambiar el sistema del
  usuario.
