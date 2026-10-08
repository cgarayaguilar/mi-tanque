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
| Números     | Como en Centroamérica: punto decimal y coma de miles ("1,500.25"), con `formatNumber`; se leen con `parseDecimal`         |

## Comandos

```bash
npm run dev            # servidor de desarrollo en http://localhost:4000 (sin service worker)
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
  ubicaciones ni datos personales en el contexto: en producción, `reportError` también lo envía a
  la función `clientErrors` del backend (`fetch` a `/api/client-errors`, que `vercel.json` reenvía;
  specs/0020). Solo van texto corto, números y sí/no del contexto, sin correos ni teléfonos.
- **Lecturas que bloquean una pantalla (specs/0020):** van con `withTimeout` (`utils/withTimeout`,
  15 s); la pantalla muestra su error con `RETRY_HINT` y "Reintentar". Al vencer, `services/firebase`
  reinicia la conexión de Firestore (en un iPhone instalado se colgaba sin fallar). Crear la cuenta o
  una organización entra con la respuesta del callable (`enter` en `store/session`), sin volver a
  leer Firestore; una lectura posterior sin perfil no devuelve a la bienvenida (`readAccountStale`).
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
  tocar el botón. El formato (Excel de Centroamérica: coma entre columnas y punto decimal; BOM;
  protección contra fórmulas) está en `utils/csv`; las columnas, en `utils/exportColumns`.
- **App Check y el lugar sin cuenta (specs/0008):** `services/firebase/core` crea la app con App
  Check (Fraud Defense, antes reCAPTCHA Enterprise; clave del sitio en `config.ts`; no con los
  emuladores) y las funciones, sin Auth ni Firestore. El modo sin cuenta lo carga solo con
  `import('services/placeLookup')` al medir con ubicación: la ciudad la da la función `geocode` del
  backend; no hay claves de terceros en el cliente. El texto de `components/RecaptchaNotice`
  reemplaza al sello oculto de reCAPTCHA.
- **Formularios (specs/0009):** ningún control abre el selector del sistema: `ChoiceButtons` para
  2–3 opciones, `SelectField` (menú de MUI) para 4–7 y `AutocompleteField` para listas largas; los
  tres reciben `control` y `name` de React Hook Form, y `ChoiceButtonsBase`/`AutocompleteBase` sirven
  para valores fuera de un formulario. Los campos no esenciales van en `MoreDetails`
  (`useMoreDetails` abre la sección y enfoca el campo si falla al guardar). Toda etiqueta opcional
  termina en "(opcional)". En los tests, `choose(label, opción)` de `src/testing/choose` elige en
  cualquiera de los tres.
- **Unidad de distancia (specs/0010):** es de la organización (`organization.distanceUnit`) y se
  conoce cuando la sesión está lista: a una organización vieja se la fija el callable
  (`settleDistanceUnit`) al leer la cuenta. Úsala con `useDistanceUnit()`; en un formulario, con
  `useFormDistanceUnit()`, que la fija al abrirlo para mostrar y guardar con la misma. El rendimiento
  y el odómetro se guardan siempre en km.
- **Rendimiento cargado y vacío (specs/0021):** `fuelEfficiencyKmPerGal` es el **cargado** (el de
  antes) y `fuelEfficiencyEmptyKmPerGal` el vacío; los dos opcionales (un camión viejo no tiene el
  vacío: se lee como `null`). Cada medición guarda `estimate` (cargado) y `estimateEmpty` (vacío),
  los dos de `readingFor` con `efficienciesOf(truck)`. El texto de lo declarado sale de
  `declaredEfficiency` (`utils/fleetLabels`). Las reglas aceptan documentos sin los campos nuevos.
- **Dinero (specs/0012):** todo monto pasa por `utils/formatMoney` (`moneyTotal` para totales,
  "C$9,274.26 NIO"; `unitPrice`/`unitPrices` para precios por galón y litro). Nombre, símbolo y
  países de cada moneda viven en `CURRENCY_DETAILS` (`schemas/account`). Litros se escribe
  completo, nunca "L" (es el símbolo del lempira). El CSV no lleva símbolos.
- **Formulario de tanque (specs/0013):** capacidad primero y las medidas en una fila; cada medida
  con su ⓘ (`MeasureHelp`, textos en `utils/measureHelp`) y la guía `MeasureGuide`. La vista
  previa `TankPreview` dibuja el tanque en 3D a escala con `utils/tankProjection` (pura, con tests
  de proporciones) y compara el volumen con la capacidad (`capacityMatches` de `utils/tankVolume`).
  Los campos (forma, posición, capacidad, medidas, guía y vista previa) son un solo componente,
  `components/TankFields`, con su validación en `schemas/tankMeasures` (límites por modo): lo usan
  el tanque de la flota y "Agrega tu tanque" sin cuenta (specs/0019 RF-5).
- **Catálogo de tanques (specs/0014, 0015):** `components/TankCatalog` (lógica pura en
  `utils/tankCatalog`) lo usan `ModelPicker` ("De un modelo", en un diálogo) y "Elige tu tanque"
  sin cuenta (todas las formas desde specs/0019). Las plantillas (`utils/tankTemplates`) son los 15
  "Genérico" y los tanques de fábrica de `src/data/truckTanks.json`, que **no se edita a mano**:
  se regenera con `npm run build:tanks` desde `data/tank-research/` (un test exige que coincidan).
  Un tanque de fábrica con fuente se mide ajustado a su capacidad (specs/0015).
  `TankSolid` dibuja el sólido para la vista previa y las miniaturas.
- **Marca y modelo del camión (specs/0016):** se eligen de `src/data/truckModels.ts` (marcas,
  modelos y la generación del catálogo por año; un test exige que cubra el catálogo), con
  "Otra marca…"/"Otro modelo…" (`OTHER_CHOICE`) y un campo de texto. Se guarda el texto, como
  antes: lo escrito a mano se reconoce con `matchBrand`/`matchModel` al abrir el camión y en los
  chips de Flota. `catalogFilterFor` da el filtro inicial de `TankCatalog` para el tanque de un
  camión.
- **Filtros (specs/0017):** una fila de chips (`FilterBar`), uno por filtro: `FilterChip` abre un
  menú con "Todas" y las opciones (buscador con más de 10) y, elegido, muestra el valor con una ×;
  `FilterToggle` es un filtro sí/no ("Archivados"). Los usan `TankCatalog` y Flota. En los tests,
  `filterBy(filtro, opción)` y `filterChip(filtro)` de `src/testing/filterBy`.
- **Tanques del teléfono (specs/0019):** `Tank` (en `types.ts`) tiene forma, posición y las medidas
  de su forma (`diameter`, o `height` y `width`), como la flota. Lo guardado antes no tiene forma:
  `readTankDimensions` (`schemas/tank`) lo lee como cilindro acostado, sin reescribir nada; para
  escribir, `parseTankDimensions`. El cálculo sin cuenta pasa por `localGeometry` y
  `localMaxInches` (`utils/fuelReading`), y el texto de un tanque por `utils/tankText`. En los
  tests, `cylinder({…})` de `src/testing/localTank` arma un cilindro.
- **Clientes (specs/0022):** una sección más de Flota (`/flota/clientes`), en el mismo store y
  servicio (`useFleetStore().clients`, colección `clients`), sin foto (`section.photo`). Los campos
  son `components/ClientFields`, con su esquema en `schemas/clients`, para reutilizarlos en el
  diálogo "Nuevo cliente" del viaje (specs/0025). El nombre no se repite: lo revisa la app con
  `clientWithName` (`foldText`), porque las reglas no pueden. Se archivan, nunca se borran.
- **Conductores (specs/0023):** igual que Clientes (`/flota/conductores`, colección `drivers`,
  `components/DriverFields`, `schemas/drivers`), con el vencimiento de la licencia y un enlace
  opcional a un miembro (`memberUid`), que no se repite entre conductores activos y que el backend
  borra cuando el miembro sale. El aviso de la licencia y el del seguro son el mismo
  `expiryNotice` (`utils/insurance`: `licenseNotice`, `insuranceNotice`).
- **Seguro (specs/0011):** `insuranceExpiresOn` de camiones y remolques es una fecha sin hora,
  `'AAAA-MM-DD'` (`utils/plainDate`); el aviso sale de `insuranceNotice` (`utils/insurance`).
- **Avisos y modales (§8.8):** todo aviso al usuario es un toast de **Sileo** (`sileo.success`,
  `error`, `warning`, `action`); todo modal es un **`<Dialog>` de MUI**. Nada de `alert`, `confirm`
  ni otras librerías. Cada mutación termina en `sileo.success` o `sileo.error` (§8.14). En los tests
  `sileo` está simulado globalmente (`src/setupTests.ts`): verifica las llamadas, no el DOM.
  Todos los toasts salen **arriba al centro** (directiva del dueño): lo fija el `<Toaster>` de
  `App.tsx`. No pases `position` en las llamadas.
- **Theme:** los tokens viven en `src/theme/tokens.ts` (reflejo de `DESIGN.md`). De ahí salen el
  theme de MUI (`src/theme/muiTheme.ts`). Cambia un color en `DESIGN.md` y en `tokens.ts`, nunca en los
  componentes.
- **Idioma:** código, identificadores, comentarios y logs en inglés; texto de cara al usuario en
  español, con la voz de `ENGINEERING_PRINCIPLES.md` §9 (tú, español neutro).
- **Commits:** Conventional Commits, un cambio lógico por commit, en una rama (nunca directo en
  `main`). Los commits de formato masivo se registran en `.git-blame-ignore-revs`.
- **Tests:** toda corrección de bug lleva su test de regresión. Los tests que tocan IndexedDB usan
  `fake-indexeddb` (configurado en `src/setupTests.ts`) y vacían las tablas en `beforeEach`.
- **El cálculo de combustible** vive solo en `src/utils/calcFuelLevel.ts` (cilindro y segmento
  circular), `src/utils/tankVolume.ts` (las demás formas y el ajuste) y `src/utils/converts.ts`
  (las únicas constantes, exactas: 25.4 mm por pulgada, 231 in³ y 3.785411784 litros por galón).
  No lo dupliques. Precisión (specs/0018):
  - **Lleno marca la capacidad:** todo tanque cuyas medidas cuadran con su capacidad (±15 %) se
    ajusta a ella (`capacityScale`; con cuenta `capacityScaleOf`, sin cuenta `localScale`); uno que
    no cuadra se calcula con las medidas y el resultado lo avisa (`CapacityMismatchNote`). Los de
    fábrica, siempre.
  - **El porcentaje es de volumen** en toda la app; sin cuenta lo da `volumePercent`, y el
    historial lo recalcula de las pulgadas (lo guardado antes era de altura).
  - **Sin redondeo intermedio:** se redondea a 2 decimales solo al mostrar o guardar. Las alturas
    se recortan al tanque.
  - `utils/tankVolume.test.ts` compara cada forma, acostada y de pie, con la integración numérica
    de su corte: un cambio de fórmula que no la cumpla no pasa.

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
- **MUI está fijado en la 7** (`@mui/material`, `@mui/icons-material` y MUI X): la licencia de MUI X
  Pro cubre la v7, y MUI X v7 solo acepta `@mui/material` 5–7. Con una clave de otra versión mayor
  sale "License key version mismatch" y la marca de agua. No los subas sin una licencia nueva.
- **Tras instalar o quitar dependencias, o renombrar archivos (p. ej. `.js` → `.ts`), reinicia
  `npm run dev`.** Con el servidor encendido, Vite puede servir dos copias de React ("Invalid hook
  call") o seguir pidiendo el archivo viejo (404), y la app queda en blanco. Si pasa: para el
  servidor, borra `node_modules/.vite` y arráncalo de nuevo.
- `typescript` está fijado en `~6.0` porque `typescript-eslint` todavía no soporta la 7.
- Si `npm install` falla con `EACCES` en `~/.npm`, la caché global de npm del usuario tiene
  problemas de permisos: usa `--cache <directorio temporal>` en vez de cambiar el sistema del
  usuario.
