# AGENTS.md — Solo Camioneros (frontend)

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

**Solo Camioneros**: una PWA para medir el nivel de combustible de tanques de camiones y flotas. El usuario elige un
tanque, ingresa las pulgadas medidas y obtiene galones y litros. Cada medición se guarda con fecha y
ubicación y se muestra en un historial. Se instala en el teléfono y funciona sin conexión.

- Producción: https://solocamioneros.com (proyecto de Vercel `mi-tanque`; `mi-tanque.vercel.app`
  redirige ahí). **Un push a `main`
  despliega a producción**; las demás ramas generan URLs de preview. Nunca hagas push a `main` sin
  la autorización explícita del dueño en la conversación.
- El backend (Firebase: Auth, Firestore, Storage y Cloud Functions, proyecto `mi-tanque-60015`,
  región us-central1) vive en el repo hermano `../solocamioneros-backend`. Ahí están los **specs**
  de cada fase (`specs/`), las ADRs del backend y las auditorías: lee el spec de la fase antes de
  tocar código del modo autenticado. Se trabaja con Spec Driven Development (spec → plan →
  implementación → auditoría) y el dueño aprueba cada spec.

## Stack

| Área        | Qué usar                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Lenguaje    | TypeScript estricto (`.ts`/`.tsx`); no queda JavaScript en `src/`                                                         |
| UI          | MUI con el theme de `src/theme/muiTheme.ts` (derivado de `DESIGN.md`)                                                     |
| Estado      | Stores de Zustand por dominio, con selectores (`selectedTank`, `tanks`, `history`, `colorMode`)                           |
| Datos       | IndexedDB vía Dexie en `src/services` (**heredado**: modo básico; el modo autenticado usa Firestore filtrado por `orgId`) |
| Formularios | React Hook Form + Zod (`zodResolver`), errores junto al campo con `NumberField`                                           |
| Iconos      | `@mui/icons-material`                                                                                                     |
| Números     | Se muestran con `formatNumber` (`utils/formatNumber`): coma decimal; se guardan con punto                                 |

## Comandos

```bash
npm run dev            # servidor de desarrollo en http://localhost:3000 (sin service worker)
npm run dev:emulators  # igual, pero el modo autenticado usa los emuladores de Firebase
                       # (arráncalos antes en ../solocamioneros-backend: npm run emulators)
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
- **Modo autenticado (specs/0002 del backend):** el estado de la cuenta vive en `store/session`. Solo
  `services/session` importa el SDK de Firebase. El store lo carga con `import()` y solo las páginas
  lazy (`/entrar`, `/bienvenida`, `/cuenta`) lo importan directo: así el modo básico nunca descarga
  el SDK (verifícalo en el build: el chunk `index` no debe contener Firestore). Las pantallas del
  modo autenticado van dentro de `SessionGate`. La flota sigue el mismo patrón: `services/fleet`
  (estático solo en páginas lazy) y `store/fleet` (con `import()`); el SDK de Storage se carga aparte,
  solo al ver o subir una foto.
  Las mediciones también (specs/0004): `services/cloudMeasurements` (páginas lazy
  `Home/CloudMeasurement` e `History/CloudHistory`, y `store/cloudHistory` con `import()`) y
  `services/importLocal` (solo con `import()` desde `hooks/useImportLocalData`). Medición e Historial
  eligen el flujo según la sesión; el cálculo de la flota vive en `utils/measurementMath` y
  `utils/tankVolume`.
  El equipo (specs/0005): `services/team` (solo en las páginas lazy `Account` e `Invitation`); los
  permisos se reflejan en `utils/roles` (`canManageMember`, `invitableRolesFor`) y los decide el
  callable `team`. Si las reglas rechazan una escritura por permisos, llama a
  `recoverFromLostPermission(error)` de `store/session` antes del toast de error.
  Los rellenos (specs/0006) existen en los dos modos: sin cuenta en Dexie (`services/localRefuels`,
  tabla `refuels` de la versión 4) y con cuenta en `services/cloudRefuels` (estático solo en páginas
  lazy; `store/cloudRefuels` con `import()`). El formulario (`components/RefuelForm`) y la lista
  (`components/RefuelList`) son los mismos; los cálculos viven solo en `utils/refuelMath`. Las fotos
  de factura sin señal esperan en la tabla `pendingInvoices` (`services/invoiceQueue`), que la sesión
  procesa al entrar y al volver la conexión.
  Exportar a CSV (specs/0007): `components/ExportButton` solo importa tipos; el código vive en
  `services/exportCloud` (Firebase) y `services/exportLocal` (Dexie), cargados con `import()` al
  tocar el botón. El formato (Excel en español, BOM, protección contra fórmulas) está en `utils/csv`;
  las columnas, en `utils/exportColumns`.
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
- **El calendario del periodo** (`components/DateModal`) es el `StaticDateRangePicker` de **MUI X
  Pro**. La licencia se lee de `VITE_MUI_X_LICENSE_KEY` (Vercel y `.env.local`; nunca en el repo).
  Sin ella funciona igual, pero muestra una marca de agua; en los tests es lo esperado.
- **Tras instalar o quitar dependencias, o renombrar archivos (p. ej. `.js` → `.ts`), reinicia
  `npm run dev`.** Con el servidor encendido, Vite puede servir dos copias de React ("Invalid hook
  call") o seguir pidiendo el archivo viejo (404), y la app queda en blanco. Si pasa: para el
  servidor, borra `node_modules/.vite` y arráncalo de nuevo.
- `typescript` está fijado en `~6.0` porque `typescript-eslint` todavía no soporta la 7.
- Si `npm install` falla con `EACCES` en `~/.npm`, la caché global de npm del usuario tiene
  problemas de permisos: usa `--cache <directorio temporal>` en vez de cambiar el sistema del
  usuario.
