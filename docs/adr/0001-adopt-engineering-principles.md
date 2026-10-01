# ADR 0001 — Adoptar los principios de ingeniería y migrar el frontend por fases

- **Estado:** Aceptado. Fases 0 y 1 hechas. Por decisión del dueño (2026-09-30), el backend
  (fase 2) se pospone: lo siguiente es la parte de la fase 3 que no depende de él.
- **Fecha:** 2026-09-30

## Contexto

El proyecto adopta [`ENGINEERING_PRINCIPLES.md`](../../ENGINEERING_PRINCIPLES.md) como contrato de
equipo antes de construir el backend. El frontend se escribió en 2021 con un stack distinto al
objetivo (§0): React 17, JavaScript, styled-components, sweetalert2, Context y datos solo en
IndexedDB, sin backend ni autenticación.

Los propios principios marcan cómo adoptarlos en código existente: **pragmático y no retroactivo**
(§3.4). No se reescribe en masa lo que funciona solo para cumplir. Pero sí se corrigen ya los
incumplimientos que son bugs o riesgos de seguridad.

Restricciones verificadas:

- **Sileo y Zustand 5 requieren React ≥ 18.** La subida a React 19 es requisito de cualquier
  pantalla migrada.
- **MUI, React Hook Form y Zod** funcionan con React 17, 18 y 19.
- Las dependencias heredadas (`react-date-range`, `react-wavify`, `wouter`, `styled-components`)
  declaran compatibilidad con React 19.
- **TypeScript 7** es la versión `latest`, pero `typescript-eslint` solo soporta hasta la 6.0: el
  repo fija `typescript@~6.0` hasta que haya soporte.
- **Sileo está en 0.x** (API sin estabilizar): se fija la versión exacta al instalarlo.

## Decisión

1. **Todo código nuevo cumple los principios desde el primer commit** (TypeScript estricto, MUI,
   Zustand, React Hook Form + Zod, Sileo, etc.).
2. **Las herramientas hacen cumplir lo que pueden** (fase 0): `tsc` estricto, ESLint con reglas
   derivadas de los principios, Prettier, pre-commit y CI.
3. **El código heredado se migra por fases.** Cada fase deja `main` en verde y desplegable. Una
   pantalla se migra entera, no a medias.
4. **Excepciones temporales**, que desaparecen al terminar la fase 3:
   - ~~`allowJs` en `tsconfig.json`~~ y ~~reglas clásicas de hooks para el JS heredado~~: retirados
     el 2026-10-01, ya no queda JavaScript en `src/`.
   - `console.error`/`console.warn` permitidos hasta decidir el monitoreo (decisión abierta 3).
   - ~~styled-components y MUI conviven~~: styled-components se retiró el 2026-10-01.

## Auditoría del código heredado (2026-09-30)

| §              | Incumplimiento                                                                                                                                                                                                                                                                                             | Dónde                                                                            | Severidad          | Fase                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| §5.5           | **API key de geocodeapi.io en el bundle y en el historial de git.** Cualquiera puede usarla con cargo a la cuenta.                                                                                                                                                                                         | `src/hooks/useMeasurement.js`                                                    | Crítica            | 2                                                                                           |
| §7.1, §7.2     | **Errores tragados que muestran éxito falso.** `createTank`/`createMeasurement` capturan el error, lo registran y resuelven igual: "Tanque agregado correctamente" aparece aunque no se haya guardado, y el tanque queda seleccionado **sin id**, así que las mediciones siguientes se guardan sin tanque. | `src/services/tanks.js`, `src/services/measurements.js`, `src/hooks/useTanks.js` | Alta (bug)         | 1 ✅                                                                                        |
| §4, §8.6       | **Doble envío.** "Calcular" no se deshabilita mientras se guarda. Dos toques guardan dos mediciones y falsean el consumo. La ventana ahora llega a 10 s porque la ubicación se pide al guardar.                                                                                                            | `src/components/Stepper`, `src/pages/Home`                                       | Alta (bug)         | 1 ✅                                                                                        |
| §8.14          | Guardar una medición no da ningún feedback, ni de éxito ni de fallo.                                                                                                                                                                                                                                       | `src/pages/Home`                                                                 | Alta               | 1 ✅                                                                                        |
| §6.1           | Todo el código es JavaScript.                                                                                                                                                                                                                                                                              | `src/`                                                                           | Alta (estructural) | 1–3                                                                                         |
| §8 (5 estados) | El historial no tiene estado de carga ni de error: mientras carga muestra "No se encontraron mediciones".                                                                                                                                                                                                  | `src/pages/History`                                                              | Media              | 3 ✅ (2026-10-01; todas las pantallas)                                                      |
| §8.7           | Formularios sin React Hook Form + Zod; errores en diálogos en vez de inline.                                                                                                                                                                                                                               | `Stepper`, `AddTank`                                                             | Media              | 3 ✅ (Medición, Agregar tanque)                                                             |
| §8.8, §8.14    | sweetalert2 en vez de Sileo; textos como "Oops...".                                                                                                                                                                                                                                                        | `src/utils/alerts.js` y sus usos                                                 | Media              | ✅ (2026-09-30)                                                                             |
| §8.11          | Contraste por debajo de AA, campos de ~35px, controles sin teclado y foco oculto.                                                                                                                                                                                                                          | Ver `DESIGN.md`                                                                  | Media              | ✅ (2026-09-30; nuevo design system con contraste verificado y campos de 44px)              |
| §10            | Estado global en Context + `localStorage`, sin Zustand.                                                                                                                                                                                                                                                    | `src/store`, `src/hooks`                                                         | Media              | 3 ✅ para los datos (`selectedTank`, `tanks`, `history`); el modo de color sigue en Context |
| §8.13          | Colores hex sueltos en componentes y un token inexistente (`theme.textSecondary`).                                                                                                                                                                                                                         | Ver `DESIGN.md`                                                                  | Baja               | ✅ (2026-09-30; ESLint lo impide)                                                           |
| §9             | Voz mezclada: "Seleccione su tanque" (usted) junto a "Ingresa…tu tanque" (tú).                                                                                                                                                                                                                             | Varios                                                                           | Baja               | 3 ✅ (2026-10-01)                                                                           |
| §6.6           | Comentarios en español.                                                                                                                                                                                                                                                                                    | Varios                                                                           | Baja               | Al tocar cada archivo                                                                       |
| —              | 3 avisos de `react-hooks/exhaustive-deps` (corregirlos cambia comportamiento).                                                                                                                                                                                                                             | —                                                                                | Baja               | ✅ (2026-10-01; ya no queda ninguno)                                                        |
| §2             | No aplica todavía: no hay Firestore.                                                                                                                                                                                                                                                                       | —                                                                                | —                  | 2–3                                                                                         |

Ya corregido en la fase 0: el cálculo de combustible no tenía tests (§11.2); código muerto en
`calcFuelLevel`; imports sin usar; `catch` silencioso en `useLocalStorage`.

## Plan por fases

### Fase 0 — Cimientos ✅

Documentación (`ENGINEERING_PRINCIPLES.md`, `DESIGN.md`, `AGENTS.md`/`CLAUDE.md`, este ADR),
`tsconfig.json` estricto, ESLint, Prettier, husky + lint-staged, CI en GitHub Actions y tests de
caracterización del cálculo.

### Fase 1 — Integridad y React 19 ✅

1. React 19 con `createRoot`; Testing Library 16. Verificado en el navegador, pantalla por pantalla.
2. Bugs de integridad corregidos, cada uno con su test de regresión (§11.4):
   - Los errores de guardado ya no se tragan: los servicios los propagan, `reportError()` los
     registra con contexto y Sileo avisa del éxito o del fallo.
   - Doble envío: botón deshabilitado ("Guardando…") con guard de reentrada, más un `intentId` por
     medición que el servicio comprueba y escribe en una sola transacción (IndexedDB v3 con índice
     único). Lo mismo para "Guardar" al crear un tanque.
3. `src/types.ts`, esquemas Zod en la frontera de datos (`src/schemas/`) y servicios, cálculo y
   conversiones en TypeScript estricto.

Hallazgos adicionales resueltos en la fase:

- **React 19 + `StrictMode`** sembraba los tanques predefinidos dos veces (30 en vez de 15): ahora
  se siembran en una transacción.
- **`react-list`** (usado por el calendario) perdía su listener de scroll al remontarse en
  desarrollo: parcheado con `patch-package` hasta reemplazar el calendario.
- Tanques guardados con medidas en texto: se normalizan a números al leer y al escribir.
- Sileo pone en mayúscula cada palabra del título y su descripción no llega a AA en el toast
  claro: corregido con dos reglas en `globalStyles`.
- **Tamaño del bundle principal:** pasó de 128 KB (gzip) con React 17 a 206 KB. React 19 suma ~20 KB
  y Sileo ~49 KB, porque depende de Framer Motion. Zod se usa como `zod/mini` (~5 KB en vez de
  ~24 KB). **Decisión pendiente del dueño:** cómo cargar Sileo (ver la conversación de la fase 1).
- Código muerto eliminado: `propTypes` (React 19 los ignora), `reportWebVitals`, `readMeasurements`
  (además leía la tabla entera sin límite) y `convertMillimetersToInches`.

La validación de pulgadas contra el diámetro del tanque sigue en el `Stepper` hasta la fase 3, donde
pasa a un esquema Zod con React Hook Form.

### Fase 2 — Backend base (repo hermano) — pospuesta

1. Cerrar con ADRs las decisiones abiertas de §0: región, modelo de cuenta (`accountId`) y roles,
   monitoreo, migración de los datos locales.
2. Proyecto Firebase, Auth, `firestore.rules` default-deny con tests en el emulador e índices
   versionados.
3. Callable de geocodificación inversa con la key en Secret Manager (`defineSecret`). **Rotar la key
   actual cuando el callable esté en producción:** rotarla antes solo expondría la nueva en el
   bundle.

### Fase 3 — Pantallas, una por una

Se adelanta a la fase 2 en todo lo que no depende del backend. Mientras no exista Firestore, los
stores de Zustand se apoyan en la capa de servicios actual (`src/services`): cuando llegue el
backend solo cambian los servicios, no las pantallas.

Orden: Medición (`Home` + `Stepper`) → Tanques (`TankSearch` + `AddTank`) → Historial.

**Medición ✅ (2026-10-01).** `pages/Home` en TSX: `Stepper` de MUI, React Hook Form + Zod
(`schemas/measurementForm`, errores junto al campo), store de Zustand `selectedTank` (misma clave
de `localStorage`; el Context heredado lo lee de ahí), `useSaveMeasurement` como único punto de
guardado y los 5 estados (vacío con CTA en vez de redirigir, parcial con "—", guardando, error con
Sileo, ideal). Componentes nuevos compartidos: `TankDiagram` y `Stat` (ya usados también por las
pantallas heredadas), `TankCard`, `FuelGauge` y `EmptyState`. Eliminados: `Stepper`,
`TankAnimation`, `TextGroup` y `Tank`. Medición ya no carga el historial al abrirse.

**Tanques ✅ (2026-10-01).** `pages/TankSearch` y `pages/AddTank` en TSX. Store de Zustand
`tanks` (siembra + lectura, una sola carga en curso, lista ordenada por tamaño) con los 5 estados
en la lista: cargando (esqueletos), error con "Reintentar", vacío, búsqueda sin resultados con
"Limpiar búsqueda" e ideal. Agregar tanque usa React Hook Form + Zod (`tankFormSchema`, mismos
límites que el esquema de guardado vía `TANK_LIMITS`), errores junto al campo, vista previa del
diagrama mientras se escribe y botón bloqueado mientras guarda. `createTank` comprueba duplicados
e inserta en **una transacción** y rechaza con `TankAlreadyExistsError` (§2.6, §7.6); el aviso de
duplicado es un toast de acción "Usarlo" que selecciona el tanque existente. Componente nuevo
`NumberField` (también en Medición). Las rutas que no son la inicial se cargan bajo demanda.
Eliminados: `CardOfTank`, `useTanks`, el `Button` heredado y `defaultTank`/`addTankForDefault`
del Context.

**Historial ✅ (2026-10-01).** `pages/History` en TSX. Store de Zustand `history` con el periodo
elegido (si no se elige, la última semana hasta hoy, recalculada en cada carga) y protección
contra respuestas fuera de orden al cambiar de periodo rápido. `readMeasurementsInPeriod`
normaliza al leer las cantidades que versiones viejas guardaron como números (§6.4).
`groupByTank` arma un resumen **por tanque** (al inicio, al final y diferencia): el resumen
heredado mezclaba en una sola cifra las mediciones de todos los tanques. Los 5 estados: cargando
(esqueletos), error con "Reintentar", periodo vacío con "Cambiar periodo" e ideal. Mediciones de la
más reciente a la más vieja, con barra de llenado accesible; con un solo tanque se abren solas.
`NavBar` migrada a MUI: enlaces reales con `aria-current`, la pestaña activa sale de la ruta.
Eliminados: `useMeasurement`, `CardHistory`, `TankHistoryCollapse`, `DetailResultsMeasurements`,
`TextField` y la dependencia `react-icons`.

Cada pantalla pasa a TSX con theme de MUI (desde `DESIGN.md`), React Hook Form + Zod, Sileo, store de
Zustand sobre Firestore filtrado por `accountId`, los 5 estados y la voz de §9.

Al terminar la última pantalla: script de migración de IndexedDB a Firestore (§2.8) y retirada de
Dexie y las excepciones que queden de esta decisión.

**Cierre del frontend ✅ (2026-10-01).** `AppBar` en TSX con MUI, modo de color en el store de
Zustand `colorMode` (misma clave de `localStorage`), estilos globales con `CssBaseline` y
`GlobalStyles`. Retirados el Context, styled-components, `react-icons`, `normalize.css`, los hooks
`useLocalStorage`/`useWindowWidth` y `allowJs`: ya no queda JavaScript en `src/`. Del stack
heredado solo queda Dexie, que se va con Firestore.

## Consecuencias

- **A favor:** el código nuevo nace alineado; la CI impide regresiones; los bugs de integridad se
  corrigen antes de que el backend los multiplique.
- **En contra:** durante la fase 3 convivieron dos sistemas de estilos y dos de feedback, y el
  bundle creció temporalmente (resuelto al cerrar la fase 3 del frontend, 2026-10-01).
