# AGENTS.md — Mi tanque (frontend)

Instrucciones para asistentes de IA. `CLAUDE.md` importa este archivo: edita solo este.

## Lee primero — son obligatorios

1. [`ENGINEERING_PRINCIPLES.md`](ENGINEERING_PRINCIPLES.md): el contrato del equipo. Todo cambio
   cumple su Definición de Terminado o documenta la excepción (ADR o comentario en el código).
2. [`DESIGN.md`](DESIGN.md): tokens y componentes, basados en el sistema de ElevenLabs (original en
   `docs/design/elevenlabs.md`). Nunca escribas colores, espaciados ni tamaños de
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

## Stack

| Área        | Qué usar                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Lenguaje    | TypeScript estricto (`.ts`/`.tsx`); no queda JavaScript en `src/`                                              |
| UI          | MUI con el theme de `src/theme/muiTheme.ts` (derivado de `DESIGN.md`)                                          |
| Estado      | Stores de Zustand por dominio, con selectores (`selectedTank`, `tanks`, `history`, `colorMode`)                |
| Datos       | IndexedDB vía Dexie en `src/services` (**heredado**: pasa a Firestore filtrado por `accountId` con el backend) |
| Formularios | React Hook Form + Zod (`zodResolver`), errores junto al campo con `NumberField`                                |
| Iconos      | `@mui/icons-material`                                                                                          |
| Números     | Se muestran con `formatNumber` (`utils/formatNumber`): coma decimal; se guardan con punto                      |

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
- **Tipos y esquemas:** las entidades se tipan en `src/types.ts` (`import type { Tank } from 'types'`)
  y se validan en la frontera de datos con los esquemas Zod de `src/schemas/`.
- **Errores:** todo `catch` llama a `reportError(error, { operation, ...contexto })`
  (`src/utils/reportError.ts`, el canal único de §7.3) y avisa al usuario con Sileo. Nunca pongas
  ubicaciones ni datos personales en el contexto.
- **Avisos y modales (§8.8):** todo aviso al usuario es un toast de **Sileo** (`sileo.success`,
  `error`, `warning`, `action`); todo modal es un **`<Dialog>` de MUI**. Nada de `alert`, `confirm`
  ni otras librerías. Cada mutación termina en `sileo.success` o `sileo.error` (§8.14). En los tests
  `sileo` está simulado globalmente (`src/setupTests.ts`): verifica las llamadas, no el DOM.
- **Theme:** los tokens viven en `src/theme/tokens.ts` (reflejo de `DESIGN.md`). De ahí salen el
  theme de MUI (`src/theme/muiTheme.ts`). Cambia un color en `DESIGN.md` y en `tokens.ts`, nunca en los
  componentes.
- **Idioma:** código, identificadores, comentarios y logs en inglés; texto de cara al usuario en
  español, con la voz de `ENGINEERING_PRINCIPLES.md` §9 (tú, español neutro).
- **Commits:** Conventional Commits, un cambio lógico por commit, en una rama (nunca directo en
  `main`). Los commits de formato masivo se registran en `.git-blame-ignore-revs`.
- **Tests:** toda corrección de bug lleva su test de regresión. Los tests que tocan IndexedDB usan
  `fake-indexeddb` (configurado en `src/setupTests.ts`) y vacían las tablas en `beforeEach`.
- **El cálculo de combustible** vive solo en `src/utils/calcFuelLevel.ts` y
  `src/utils/converts.ts`, fijado por tests de caracterización. No lo dupliques.

## Lo no obvio

- Los datos viven en el IndexedDB del navegador **por origen**: cambiar el dominio de producción
  hace perder las mediciones de los usuarios. `localhost` y `127.0.0.1` son orígenes distintos, útil
  para probar con la base vacía.
- El service worker solo existe en el build de producción: prueba el comportamiento de PWA con
  `npm run build && npm run preview`. Tras un deploy, las apps instaladas muestran el aviso de nueva
  versión.
- `patches/react-list+0.8.19.patch` (aplicado por `patch-package` en `postinstall`) corrige el
  calendario del historial en desarrollo: `StrictMode` remonta los componentes y `react-list` perdía
  su listener de scroll. Bórralo junto con `react-date-range` cuando se reemplace el calendario
  (fase 3).
- **Tras instalar o quitar dependencias, o renombrar archivos (p. ej. `.js` → `.ts`), reinicia
  `npm run dev`.** Con el servidor encendido, Vite puede servir dos copias de React ("Invalid hook
  call") o seguir pidiendo el archivo viejo (404), y la app queda en blanco. Si pasa: para el
  servidor, borra `node_modules/.vite` y arráncalo de nuevo.
- `typescript` está fijado en `~6.0` porque `typescript-eslint` todavía no soporta la 7.
- Si `npm install` falla con `EACCES` en `~/.npm`, la caché global de npm del usuario tiene
  problemas de permisos: usa `--cache <directorio temporal>` en vez de cambiar el sistema del
  usuario.
