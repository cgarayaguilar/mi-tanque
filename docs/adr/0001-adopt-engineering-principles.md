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
   - `allowJs` en `tsconfig.json`: el JS heredado compila sin chequeo de tipos.
   - El JS heredado solo pasa las reglas clásicas de hooks. Las reglas del React Compiler aplican a
     TypeScript.
   - `console.error`/`console.warn` permitidos hasta decidir el monitoreo (decisión abierta 3).
   - styled-components y MUI conviven mientras dure la fase 3: el bundle crece temporalmente.

## Auditoría del código heredado (2026-09-30)

| §              | Incumplimiento                                                                                                                                                                                                                                                                                             | Dónde                                                                            | Severidad          | Fase                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------ | ---------------------- |
| §5.5           | **API key de geocodeapi.io en el bundle y en el historial de git.** Cualquiera puede usarla con cargo a la cuenta.                                                                                                                                                                                         | `src/hooks/useMeasurement.js`                                                    | Crítica            | 2                      |
| §7.1, §7.2     | **Errores tragados que muestran éxito falso.** `createTank`/`createMeasurement` capturan el error, lo registran y resuelven igual: "Tanque agregado correctamente" aparece aunque no se haya guardado, y el tanque queda seleccionado **sin id**, así que las mediciones siguientes se guardan sin tanque. | `src/services/tanks.js`, `src/services/measurements.js`, `src/hooks/useTanks.js` | Alta (bug)         | 1 ✅                   |
| §4, §8.6       | **Doble envío.** "Calcular" no se deshabilita mientras se guarda. Dos toques guardan dos mediciones y falsean el consumo. La ventana ahora llega a 10 s porque la ubicación se pide al guardar.                                                                                                            | `src/components/Stepper`, `src/pages/Home`                                       | Alta (bug)         | 1 ✅                   |
| §8.14          | Guardar una medición no da ningún feedback, ni de éxito ni de fallo.                                                                                                                                                                                                                                       | `src/pages/Home`                                                                 | Alta               | 1 ✅                   |
| §6.1           | Todo el código es JavaScript.                                                                                                                                                                                                                                                                              | `src/`                                                                           | Alta (estructural) | 1–3                    |
| §8 (5 estados) | El historial no tiene estado de carga ni de error: mientras carga muestra "No se encontraron mediciones".                                                                                                                                                                                                  | `src/pages/History`                                                              | Media              | 3                      |
| §8.7           | Formularios sin React Hook Form + Zod; errores en diálogos en vez de inline.                                                                                                                                                                                                                               | `Stepper`, `AddTank`                                                             | Media              | 3                      |
| §8.8, §8.14    | sweetalert2 en vez de Sileo; textos como "Oops...".                                                                                                                                                                                                                                                        | `src/utils/alerts.js` y sus usos                                                 | Media              | ✅ (2026-09-30)        |
| §8.11          | Contraste por debajo de AA en varios tokens; links hechos con `h3`/`h4` + `onClick` (sin teclado); input con área táctil de ~35px.                                                                                                                                                                         | Ver `DESIGN.md`                                                                  | Media              | 3                      |
| §10            | Estado global en Context + `localStorage`, sin Zustand.                                                                                                                                                                                                                                                    | `src/store`, `src/hooks`                                                         | Media              | 3 (con Firestore)      |
| §8.13          | Colores hex sueltos en componentes y un token inexistente (`theme.textSecondary`).                                                                                                                                                                                                                         | Ver `DESIGN.md`                                                                  | Baja               | 3                      |
| §9             | Voz mezclada: "Seleccione su tanque" (usted) junto a "Ingresa…tu tanque" (tú).                                                                                                                                                                                                                             | Varios                                                                           | Baja               | 3                      |
| §6.6           | Comentarios en español.                                                                                                                                                                                                                                                                                    | Varios                                                                           | Baja               | Al tocar cada archivo  |
| —              | 3 avisos de `react-hooks/exhaustive-deps` (corregirlos cambia comportamiento).                                                                                                                                                                                                                             | `useMeasurement`, `Home`, `TankSearch`                                           | Baja               | Al migrar cada archivo |
| §2             | No aplica todavía: no hay Firestore.                                                                                                                                                                                                                                                                       | —                                                                                | —                  | 2–3                    |

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

Orden: Medición (`Home` + `Stepper`) → Tanques (`TankSearch` + `AddTank`) → Historial. Cada
pantalla pasa a TSX con theme de MUI (desde `DESIGN.md`), React Hook Form + Zod, Sileo, store de
Zustand sobre Firestore filtrado por `accountId`, los 5 estados y la voz de §9.

Al terminar la última pantalla: script de migración de IndexedDB a Firestore (§2.8) y retirada de
styled-components, `react-icons`, Dexie, `allowJs` y las excepciones de esta decisión.

## Consecuencias

- **A favor:** el código nuevo nace alineado; la CI impide regresiones; los bugs de integridad se
  corrigen antes de que el backend los multiplique.
- **En contra:** durante la fase 3 conviven dos sistemas de estilos y dos de feedback, y el bundle
  crece temporalmente. `allowJs` es una excepción explícita a §6.1 hasta el final de la fase 3.
