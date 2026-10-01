# PRINCIPIOS DE INGENIERÍA — Mi tanque

> **Versión local del proyecto.** Este archivo deriva del documento maestro global de principios de
> ingeniería y está adaptado al dominio de **Mi tanque** (medición del nivel de combustible en
> tanques cilíndricos horizontales). Cuando una regla global cambie, se cambia **primero en el
> maestro** y después se trae aquí. Lo específico de este proyecto (§0, decisiones abiertas,
> ejemplos del dominio) solo vive aquí.
>
> **Es contrato de equipo:** no son sugerencias, es el estándar mínimo. Cada regla trae su _por
> qué_; si se rompe una, se deja escrito el motivo (ADR en `docs/adr/` o comentario en el código).
>
> - `AGENTS.md` / `CLAUDE.md` apuntan a este archivo y a [`DESIGN.md`](DESIGN.md) para que
>   cualquier asistente de IA genere código alineado desde el primer prompt.
> - El estado de adopción y el plan de migración del código heredado están en
>   [ADR 0001](docs/adr/0001-adopt-engineering-principles.md).
> - El backend vivirá en un repo hermano con **su propia copia** de este archivo.

---

## §0. Stack del proyecto

| Decisión                  | Por defecto                                | Este proyecto (objetivo)                                                                                                               | Estado actual del código                                                          |
| ------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Frontend                  | React 19 + Vite + TypeScript               | React 19 + Vite + TypeScript                                                                                                           | ✅ React 19 + Vite 8; JS heredado + TS estricto para código nuevo                 |
| Estado global             | Zustand                                    | Zustand                                                                                                                                | React Context + hooks (`src/store`)                                               |
| Estilos / UI              | Material UI (MUI) + theme central          | MUI + theme derivado de `DESIGN.md`                                                                                                    | styled-components 5 (theme en `src/store/initialState.js`)                        |
| Design system             | `DESIGN.md`                                | [`DESIGN.md`](DESIGN.md)                                                                                                               | ✅ Documentado                                                                    |
| Toasts / feedback         | **Sileo**                                  | Sileo para **todo** aviso o notificación al usuario                                                                                    | ✅ Sileo en toda la app                                                           |
| Modales                   | MUI `<Dialog>`                             | MUI `<Dialog>` para **todo** modal                                                                                                     | ✅ MUI `<Dialog>` (selector de periodo)                                           |
| Formularios               | **React Hook Form** + **Zod**              | React Hook Form + Zod                                                                                                                  | `FormData` + validación manual                                                    |
| Fechas                    | **date-fns**                               | date-fns                                                                                                                               | ✅ date-fns 2 (subir a la versión actual en la migración)                         |
| Utilidades                | **lodash-es**                              | lodash-es                                                                                                                              | Se instala con su primer uso (ESLint ya bloquea `lodash` y el import por defecto) |
| Backend                   | Firebase Cloud Functions v2 (Node.js + TS) | Cloud Functions v2 en repo hermano                                                                                                     | Por construir                                                                     |
| Base de datos             | Cloud Firestore                            | Cloud Firestore                                                                                                                        | IndexedDB local (Dexie), sin sincronización                                       |
| Autenticación             | Firebase Auth                              | Firebase Auth                                                                                                                          | Sin autenticación                                                                 |
| Secretos                  | GCP Secret Manager (`defineSecret`)        | Secret Manager                                                                                                                         | ⚠️ API key de geocodeapi.io escrita en el bundle (`useMeasurement.js`)            |
| Errores / monitoreo       | Sentry                                     | **Decisión abierta** (ver abajo)                                                                                                       | `console.error`                                                                   |
| Tests                     | Vitest + Testing Library                   | Vitest + Testing Library (+ emulador de Firebase en backend)                                                                           | ✅ Vitest 5 + Testing Library + fake-indexeddb                                    |
| Deploy                    | Vercel + `firebase deploy`                 | Vercel (proyecto `mi-tanque`) + `firebase deploy`                                                                                      | ✅ Vercel: push a `main` = producción; otras ramas = preview                      |
| PWA                       | —                                          | Instalable y usable sin conexión                                                                                                       | ✅ vite-plugin-pwa (precache + aviso de nueva versión)                            |
| TypeScript                | **Estricto, ambos repos**                  | **Estricto**                                                                                                                           | ✅ `tsconfig.json` estricto; JS heredado vía `allowJs` mientras se migra          |
| Región Firebase           | us-central1                                | **Decisión abierta** (ver abajo)                                                                                                       | —                                                                                 |
| Idioma del código         | English                                    | English                                                                                                                                | Comentarios heredados en español: se traducen al tocar cada archivo               |
| Idioma de cara al usuario | Español                                    | Español                                                                                                                                | ✅                                                                                |
| Quién hace deploy         | —                                          | El dueño autoriza cada deploy. El asistente solo hace push a `main` o `firebase deploy` con autorización explícita en la conversación. | ✅                                                                                |

**Arquitectura de repos:** front y backend son **superficies desplegables independientes**. El
cliente llama al backend vía **callables** (`httpsCallable` ↔ `onCall`). El frontend **puede**
escribir CRUD simple directo a Firestore (protegido por reglas); la lógica crítica va a Cloud
Functions. Comparten el mismo proyecto Firebase y región.

### Decisiones abiertas (se cierran con un ADR antes de construir lo que dependa de ellas)

1. **Región de Firebase/Firestore.** La ubicación de Firestore **no se puede cambiar** después de
   crear la base. Se decide al crear el proyecto Firebase, según dónde estén los usuarios y la
   región de Vercel (hoy `iad1`).
2. **Modelo de inquilino (`accountId`).** Qué es una "cuenta" en Mi tanque (¿una persona, un hogar,
   un negocio con varios tanques y miembros?) y sus roles (§5.3). Define el modelo de datos de todo
   el backend.
3. **Monitoreo de errores** (Sentry u otro). Hasta decidirlo, los errores se registran con
   `console.error` con contexto y se informa al usuario (§7.2 a y c); la parte (b) queda pendiente.
4. **Datos locales existentes.** Cómo migran a Firestore las mediciones que hoy viven en IndexedDB
   en el teléfono de cada usuario (§2.8), sin perderlas.

---

## §1. Filosofía y postura de trabajo

1. **Sé un senior exigente, no un complaciente.** Cuando algo sea ineficiente, caro en Firestore,
   frágil o inseguro, **objétalo con la razón técnica** y propón la alternativa óptima.
2. **Principio rector: UX ↔ Costo.** Toda decisión equilibra (a) experiencia de usuario y (b) costo
   de operar — **cada lectura/escritura de Firestore y cada invocación de Cloud Function cuesta
   dinero real**. Busca el óptimo; cuando estén en tensión, **explicita el trade-off** y deja que el
   dueño decida. Ni sacrificar UX por un ahorro marginal, ni quemar presupuesto por una mejora
   cosmética.
3. **Interroga antes de construir** (features y cambios de modelo de datos; los triviales van
   directo):
   - **Impacto:** ¿qué problema resuelve, quién lo usa, con qué frecuencia?
   - **Casos borde:** pérdida de red a mitad de operación (frecuente: la app se usa junto al
     tanque, a menudo con mala señal), dos usuarios editando el mismo doc, entradas inválidas
     (pulgadas mayores que el diámetro), estado vacío.
   - **Costo vs. valor:** lecturas/escrituras estimadas por operación; ¿hay una forma más barata de
     obtener el 90% del beneficio?
   - **Diseña el modelo de datos primero** (estructura del documento, qué se cachea en Zustand, Big-O
     de las consultas) y **valida el enfoque y el costo proyectado antes de escribir código.**
4. **Principio de menor sorpresa, optimiza para lectura, entrega trabajo terminado.** Nada de stubs,
   `TODO` silenciosos ni archivos a medias que rompan la compilación. El código se lee 10× más de lo
   que se escribe.

---

## §2. Firestore: modelo de datos y costos

1. **Arquitectura plana multi-tenant.** Colecciones **root-level**, nunca subcolecciones anidadas
   (`accounts/{id}/tanks` ❌). Toda entidad de un inquilino (tanques, mediciones) lleva
   **`accountId: string`** en su interfaz y en su payload. Toda query incluye
   **`where('accountId', '==', activeAccountId)`** sin excepción — esto previene fuga de datos entre
   cuentas (BOLA).
2. **Cero N+1.** Nunca consultes Firestore dentro de un `map`/`forEach`. Usa `where('id','in',[...])`
   (lotes de ≤30), lecturas por lote, o lee del store. Una pantalla no dispara docenas de
   round-trips. _(Ejemplo del dominio: el historial obtiene los tanques de sus mediciones con una
   sola lectura por lote, no una por medición.)_
3. **Siempre acota.** Prohibido `getDocs()` abierto sobre una colección. Usa `limit()`, paginación
   por cursor (`startAfter`), o filtros por rango (el historial ya filtra por rango de fechas). No
   descargues miles de docs.
4. **Caché-primero (Zustand).** Lee del store antes de golpear Firestore. Usa `onSnapshot` **solo**
   cuando necesites tiempo real, y **cancela la suscripción** (`unsubscribe`) al desmontar o al
   cambiar de cuenta. Cada doc escuchado cuesta lecturas.
5. **Complejidad objetivo O(1)** en lecturas frecuentes; **O(n)** solo con `n` acotado y conocido.
   Propón **desnormalización y campos agregados** (ej. la última medición o el consumo del periodo
   precalculados en el doc del tanque) que eviten recorrer colecciones enteras en cada lectura;
   documenta cómo se mantienen sincronizados.
6. **Operaciones multi-documento = atómicas.** Para crear/editar/borrar varios docs usa
   **`writeBatch`**; para leer-modificar-escribir con consistencia usa **`runTransaction`**. Nunca
   dejes el sistema en un estado intermedio observable.
7. **Índices compuestos versionados.** Cada query que los necesite añade su índice en
   `firestore.indexes.json`. Considera reportar los errores de índice faltante a un canal de alerta.
8. **Migraciones de datos con script versionado y reversible**, nunca cambios manuales en la consola
   de producción. _(Incluye la migración de IndexedDB a Firestore: decisión abierta 4 de §0.)_
9. **Las lecturas van directo a Firestore, nunca vía callable.** Leer a través de un callable puede
   sumar un cold start y una invocación a cada carga de pantalla, y no aprovecha la caché local de
   Firestore. Si las reglas no permiten una lectura legítima, ajusta el modelo: desnormaliza el campo
   que la regla necesita, separa los campos privados en su propio doc y publica los catálogos (ej.
   los tanques predefinidos) en Firestore o Storage para que el cliente los lea con caché.
   Excepción: lecturas que necesitan secretos o APIs de terceros (§3.3), como la geocodificación
   inversa de la ubicación de una medición.

---

## §3. Backend (Cloud Functions) = fuente de verdad

1. **La lógica crítica vive en Cloud Functions.** Cálculos sensibles, validaciones de negocio,
   anti-duplicados y operaciones multi-documento se ejecutan donde el cliente no puede manipularlas.
   **La idempotencia y la integridad mandan sobre el uso sin conexión:** no muevas lógica crítica al
   cliente solo para que funcione offline. La resiliencia ante cortes de red viene del reintento
   seguro con el mismo `intentId` (§4); sin conexión, la UI lo dice con un mensaje claro en vez de
   fallar en silencio. Elige el disparador según si el usuario necesita esperar el resultado:
   - **Callable `onCall` (v2)**, invocado con `httpsCallable`, cuando el usuario necesita la
     respuesta para continuar.
   - **Trigger de Firestore** (`onDocumentCreated`/`onDocumentWritten`) para efectos secundarios
     que el usuario no necesita esperar (desnormalizaciones, contadores, propagaciones,
     notificaciones): su cold start ocurre fuera del camino del usuario. Un trigger puede
     ejecutarse más de una vez por el mismo evento → debe ser idempotente (§4).
2. **El cliente valida primero, pero nunca es la autoridad.** La validación en el cliente da
   _feedback inmediato_ (UX); la del servidor + `firestore.rules` es la que protege la integridad.
   **Valida en ambos lados.**
3. **CRUD simple puede escribir directo a Firestore desde el cliente** (protegido por reglas). No
   todo necesita un callable. **Criterio de corte:** _integridad/seguridad → backend; CRUD trivial
   sin riesgo → cliente está bien._ **Las lecturas no pasan por callables:** si las reglas no
   permiten una lectura legítima, ajusta el modelo (desnormaliza, separa los campos privados en su
   propio doc, publica los catálogos en Firestore o Storage) para que el cliente lea directo, con
   caché. Excepción: lecturas que necesitan secretos o APIs de terceros.
4. **Pragmático y no retroactivo.** Aplica a desarrollo nuevo y lógica crítica. **No refactorices en
   masa** lo que ya funciona solo para "cumplir"; migrar algo existente detrás de un callable es un
   esfuerzo aparte (ver el plan por fases del ADR 0001).
5. **Arquitectura limpia en el backend.** Separa capas: handler (validación/auth) → caso de uso
   (lógica) → acceso a datos. La lógica de negocio no conoce de `onCall` ni de Firestore directamente,
   para poder testearla aislada.
6. **Deriva la identidad de `request.auth`,** nunca de un campo que el cliente envíe. Rechaza con
   `HttpsError('unauthenticated'/'permission-denied', …)` cuando corresponda.
7. **Valida el payload de entrada con un esquema** (`zod`) en cada callable; rechaza lo que no
   matchee antes de tocar datos.
8. **Cold starts sin costo fijo** (política en §12.5; aquí, la implementación). Cada función
   exportada es un servicio aparte con su propio arranque en frío, que puede tardar segundos.
   `minInstances` cobra 24/7 aunque nadie use la función, así que **no se usa por defecto**. Ataca
   el cold start en este orden:
   1. **Sácalo del camino del usuario:** lecturas directas (§3.3), efectos secundarios en triggers
      (§3.1) y como máximo **un** callable por acción del usuario (no encadenes llamadas).
   2. **Arranque liviano:** no cargues a nivel de módulo lo que no usan todas las funciones
      (inicializa Storage, Auth y clientes de terceros de forma perezosa). Inicializa Firestore Admin
      con `initializeFirestore(app, { preferRest: true })`: usa REST y solo carga gRPC si alguien
      abre un `onSnapshot`. Sin dependencias pesadas para algo trivial; funciones en la misma región
      que Firestore.
   3. **Menos servicios:** agrupa los callables interactivos de un mismo dominio en uno solo (campo
      `action` + unión discriminada de Zod), así una instancia caliente atiende varias acciones.
      Deja aparte los pesados y los que usan secretos.
   4. **Precalienta solo cuando se va a usar:** al abrir la pantalla o el formulario que termina en
      un callable, el cliente envía `{ warmup: true }` sin esperar respuesta; el handler devuelve
      `{ ok: true }` de inmediato y sin tocar datos (es lo único permitido antes de validar auth y
      payload). Un fallo del precalentado se ignora a propósito: no es una acción del usuario
      (excepción explícita a §7). Si aún duele en los 2–3 callables más usados, un ping programado
      **solo en horario laboral** los mantiene calientes. Ambas opciones cuestan centavos: una
      instancia ociosa sin `minInstances` no se cobra.
   5. **`minInstances` es el último recurso:** solo con métricas de latencia que lo justifiquen y el
      costo mensual aprobado por el dueño.

   Mide la latencia en frío y en caliente antes y después de cada cambio.

---

## §4. Idempotencia e integridad de datos

> Una operación repetida (doble-click, reintento por red intermitente, reenvío) **no debe** producir
> efecto doble. En Mi tanque, una medición duplicada falsea el consumo del periodo: esto no es
> opcional.

1. **ID determinista por intención (`intentId`/`idempotencyKey`).** Genera un UUID estable **al ABRIR
   el formulario** (no uno nuevo por click). Úsalo como **id del documento** o como campo
   `idempotencyKey`.
2. **Verificar-y-escribir atómico en el backend.** El callable comprueba si la `idempotencyKey` ya
   existe **dentro de la misma `runTransaction`** en que escribe el resultado. Misma clave ⇒ mismo
   resultado, sin doble efecto.
3. **Reintentos seguros por diseño.** Toda función que mute estado debe poder reintentarse sin daño,
   incluidos los triggers de Firestore, que pueden ejecutarse más de una vez por el mismo evento.
   Asume que la red fallará y el cliente reintentará.
4. **Normaliza entradas con una única función** (pulgadas, galones, fechas, strings) y reúsala; no
   repartas el parseo por todo el código. _(Las conversiones de unidades viven en
   `src/utils/converts.js`; el cálculo de volumen en `src/utils/calcFuelLevel.js`.)_
5. **La idempotencia manda sobre el uso sin conexión.** No muevas lógica crítica al cliente solo para
   que funcione offline: las transacciones del cliente no funcionan sin red y un rechazo al
   sincronizar puede pasar inadvertido. La resiliencia ante cortes viene de reintentar con el mismo
   `intentId`; si no hay conexión, la UI lo dice con un mensaje claro en vez de un error genérico.

---

## §5. Seguridad

1. **`firestore.rules` default-deny.** Niega por defecto; permite solo lo explícito. Centraliza la
   autorización en un helper (ej. `getMemberRole(accountId)` que lee `members/{accountId}_{uid}.role`).
2. **Autorización en el servidor/reglas, no en la UI.** Ocultar/deshabilitar un botón es **UX**, no
   seguridad. El control real vive en `firestore.rules` y en los callables, y se verifica en cada
   operación.
3. **RBAC explícito y reusado.** Roles propuestos: `owner` / `write` / `read` (se confirman con la
   decisión abierta 2 de §0). Defínelos en un solo lugar; expón el rol en el estado global y reúsalo
   con un selector único (`canWrite(account)`), no copiando la condición por todos lados.
4. **Nunca confíes en datos del cliente.** Valida y sanea **toda** entrada en reglas y/o callable:
   tipos, rangos, longitudes, formato. Valida ids (`^[a-zA-Z0-9_\-]+$`, longitud acotada). En
   `update`, verifica que no se pueda mover un doc entre cuentas
   (`request.resource.data.accountId == resource.data.accountId`).
5. **Los secretos jamás llegan al cliente ni al repo.** API keys de terceros, webhooks y credenciales
   viven **solo** en **Secret Manager** (`defineSecret` + binding por función). Nada de secretos en el
   bundle de React, en logs, ni commiteados. _(La config web de Firebase sí es pública — la seguridad
   la dan las reglas, no esconder el `apiKey`.)_ **Incumplimiento activo:** la key de geocodeapi.io
   está en el bundle y en el historial de git; se mueve a un callable y **se rota** (ADR 0001).
6. **Menor privilegio.** Cada función y credencial con el mínimo alcance. Rota y revoca lo que no se
   usa.
7. **Mantén un registro de payloads adversarios** ("dirty dozen") que tus reglas deben seguir
   rechazando, y revísalo ante cada cambio de `firestore.rules`. Prueba las reglas con el emulador.
8. **Higiene de dependencias** (lockfile commiteado, `npm audit`/Dependabot). No metas dependencias
   pesadas para algo trivial.

---

## §6. TypeScript estricto y calidad de código (ambos repos)

1. **`strict: true` siempre, en frontend y backend.** Este repo usa exactamente esta base en
   `tsconfig.json`:
   ```jsonc
   {
     "compilerOptions": {
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "noImplicitOverride": true,
       "noFallthroughCasesInSwitch": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "forceConsistentCasingInFileNames": true,
       "exactOptionalPropertyTypes": true,
     },
   }
   ```
   _Excepción temporal documentada (ADR 0001):_ `allowJs` permite que el código JS heredado siga
   compilando mientras se migra. **Todo archivo nuevo es `.ts`/`.tsx`**, y un archivo JS que se
   modifica de forma sustancial se migra a TS en ese mismo cambio.
2. **Prohibido `any`.** Si no conoces el tipo, usa `unknown` y estrecha. Toda entidad que cruce
   UI↔Firestore↔callable se tipa en un lugar canónico (`src/types.ts`), compartido conceptualmente
   entre repos.
3. **Sin placeholders ni archivos a medias.** Entrega cada archivo completo y funcional; no omitas
   funciones existentes al refactorizar (rompe la compilación).
4. **Tipa los datos de Firestore al leerlos** (no asumas que el doc tiene la forma esperada); valida
   en la frontera lo que venga de la red. Lo mismo aplica hoy a lo que se lee de IndexedDB y
   `localStorage`.
5. **Nombres que se explican solos; funciones pequeñas con una responsabilidad.** DRY con criterio:
   elimina duplicación real, pero **no sobre-abstraigas** (una mala abstracción cuesta más que algo de
   duplicación).
6. **Separación de idioma:** código, identificadores, archivos, comentarios y logs en **inglés**;
   solo el texto de cara al usuario en el idioma del producto (§9).
7. **Lint + formato automáticos** (ESLint + Prettier) en pre-commit y CI; `tsc --noEmit` en verde
   antes de integrar. El estilo lo decide la herramienta, no el PR. _(Implementado: husky +
   lint-staged en pre-commit; `.github/workflows/ci.yml` corre typecheck, lint, formato, tests y
   build. Varias reglas de este documento son errores de ESLint: ver `eslint.config.mjs`.)_
8. **Comenta el _por qué_, no el _qué_. Borra el código muerto** (imports/vars sin usar, ramas
   inalcanzables). El control de versiones es tu historial.
9. **Utilidades canónicas — no reinventes la rueda (y mantén el tree-shaking).**
   - **`lodash-es`** para validación y manipulación de objetos/arrays: úsalo **siempre** para
     comprobar/transformar estructuras (`isEmpty`, `isEqual`, `isNil`, `get`, `groupBy`, `uniqBy`,
     `cloneDeep`, `omit`, `pick`…) en lugar de chequeos manuales frágiles. Importa por **named import**
     (`import { isEmpty } from 'lodash-es'`); **nunca** `import _ from 'lodash'` (rompe el
     tree-shaking). _(ESLint lo bloquea.)_
   - **`date-fns`** para **TODO** manejo de fechas (parseo, formato, aritmética, comparación,
     rangos). Nada de `new Date()` aritmético a mano ni librerías pesadas; named imports para
     tree-shaking.

---

## §7. Manejo de errores — cero errores silenciosos

1. **Jamás te tragues un error.** Prohibido el `catch {}` vacío o el que solo hace `console.log` y
   sigue. Un error silenciado es un bug que aparece en producción sin pistas. _(ESLint bloquea el
   `catch` vacío.)_
2. **Captura → reporta → da feedback.** Todo `catch`: (a) **registra** con contexto (uid, operación,
   parámetros — sin datos sensibles), (b) **reporta** al monitoreo (decisión abierta 3 de §0), y (c)
   **informa al usuario** con un mensaje amable y accionable (§8/§9).
3. **Errores de Firestore por un canal único.** Centraliza un `handleFirestoreError(err, op, path)`
   que loguee con contexto de auth y reporte los casos especiales (ej. índice faltante). No disperses
   `try/catch` ad-hoc.
4. **En el backend, usa `HttpsError` con códigos correctos** (`invalid-argument`, `permission-denied`,
   `failed-precondition`, `already-exists`…) para que el cliente reaccione bien. Loguea el detalle
   técnico en el servidor, devuelve un mensaje seguro al cliente.
5. **Falla ruidosamente en dev, con gracia en prod.** Nunca muestres stack traces ni JSON roto al
   usuario final. Un `ErrorBoundary` global captura lo inesperado en React.
6. **No uses errores para flujo de control normal;** distingue error de dominio (pulgadas mayores
   que el diámetro del tanque) de error de programación de error de infraestructura.

---

## §8. UX/UI — los 5 estados y reglas (React 19)

> **Para CADA pantalla, módulo o componente complejo es obligatorio manejar los 5 estados.** Nunca
> entregues algo que solo funcione en el "estado ideal".

1. **Carga.** MUI `<Skeleton>` que replique la estructura por venir, o `<CircularProgress>` contenido.
   Renderízalo mientras el flag `loading` del store de Zustand sea `true`.
2. **Vacío.** 0 resultados ≠ lista colapsada. Ícono opaco + mensaje claro + **CTA primario**
   (`<Button>`) de primera acción ("Registra tu primera medición").
3. **Error.** MUI `<Alert severity="error">` con mensaje amigable de negocio + botón **"Reintentar"**
   (re-ejecuta la acción del store) + acceso a soporte. Sin stack traces.
4. **Parcial / Onboarding.** Para data incompleta, destaca lo que falta con `<Alert severity="warning">`.
   Si una acción está bloqueada, **deshabilita el botón pero explica por qué** envolviéndolo en un
   `<Tooltip>` con el paso a completar (ej. "Calcular" sin tanque elegido). Nunca un botón muerto y
   mudo.
5. **Ideal.** Trunca texto largo (`<Typography noWrap>` / `textOverflow: 'ellipsis'`), formatea con
   helpers **únicos y reutilizados** (`formatGallons`, `formatLiters`; fechas **siempre con
   `date-fns`**), y deja que la jerarquía visual guíe el ojo a la acción principal.

**Reglas transversales:**

6. **Prevención de doble-envío.** Deshabilita el submit mientras la operación async corre + spinner
   en el botón + guard de reentrada. Conecta con la `idempotencyKey` de §4. En React 19, apóyate en
   **`useActionState` / `useFormStatus`** para el estado `pending` del formulario.
7. **Validación estricta de formularios con React Hook Form + Zod.** Todo formulario usa **React
   Hook Form** con un **esquema Zod** vía `zodResolver`. El esquema es la única fuente de verdad de la
   validación: requeridos, tipos, rangos, sin negativos donde no aplica, coerción segura de números.
   Errores **inline** en lenguaje claro. **Reutiliza el mismo esquema Zod en el callable del backend**
   (§3.7) para validar en ambos lados sin duplicar reglas. Una entrada inválida nunca rompe la app ni
   se persiste.
8. **Toasts = Sileo; modales = MUI `<Dialog>`; nada nativo.** _(Directiva del dueño, 2026-09-30.)_
   - **Todo** aviso o notificación al usuario es un toast de **Sileo**: éxito y fallo de mutaciones
     (§8.14), errores de validación, avisos del sistema (nueva versión, lista sin conexión). Los
     avisos que requieren una acción usan `sileo.action` con botón.
   - **Todo** modal es un MUI `<Dialog>`: selectores, formularios en ventana y confirmaciones de
     acciones destructivas (eliminar/archivar).
   - Prohibido `alert()`/`confirm()`/`prompt()` nativos y cualquier otra librería de avisos o modales:
     el nativo bloquea el hilo, no se estiliza y rompe el tono. _(ESLint bloquea los nativos.)_
9. **UI optimista con rollback.** Para operaciones críticas la UI optimista es solo capa visual: el
   dato real es el del servidor; revierte si falla. En React 19 usa **`useOptimistic`** para esto.
10. **Concurrencia.** Dos usuarios pueden editar el mismo doc a la vez: refleja el último estado del
    `onSnapshot`; no asumas que tu copia local es la verdad.
11. **Accesibilidad.** `aria-label`/rol semántico en interactivos, foco visible, navegación por
    teclado en modales/formularios, contraste (ver la tabla de contraste de `DESIGN.md`) y targets
    táctiles adecuados.
12. **Rendimiento.** Listas largas: pagina/limita o virtualiza. Cancela `onSnapshot` al desmontar.
    Usa **selectores de Zustand** (`useStore(s => s.x)`) para no re-renderizar de más; `getState()`
    para lecturas no reactivas. _(Si usas el React Compiler, evita micro-optimizar con
    `useMemo`/`useCallback` manuales salvo que el perfilado lo pida.)_
13. **Estilos vía el theme de MUI, nunca valores hardcodeados.** Colores, tipografía, espaciado,
    radios y sombras viven en el **theme central de MUI** y se documentan en **`DESIGN.md`** (§14).
    Usa `sx`/`styled`/variantes del theme y los tokens (`theme.palette.*`, `theme.spacing()`); nada
    de hex sueltos ni píxeles mágicos en el JSX. Define un solo `<ThemeProvider>` en la raíz.
    _(ESLint rechaza los colores hex fuera de `src/theme/tokens.ts`.)_
14. **Feedback obligatorio tras CADA mutación (Sileo).** Toda acción que escriba o mute datos
    (guardar una medición, crear un tanque, eliminar…) **DEBE** confirmar al usuario el resultado —
    éxito **o** fallo — usando **Sileo**. Una mutación silenciosa (sin feedback) se considera
    **incompleta**. Patrón:
    ```tsx
    import { sileo, Toaster } from 'sileo'
    // Un único <Toaster position="bottom-center" /> en la raíz, junto al <ThemeProvider>.

    // Éxito:
    sileo.success({ title: 'Medición guardada' })
    // Fallo (en el mismo catch que reporta el error — §7):
    sileo.error({
      title: 'No pudimos guardar la medición',
      description: 'Reintenta en un momento.',
    })
    // Operación async (encadena loading → éxito/error desde una sola promesa):
    sileo.promise(saveMeasurement(), {
      loading: { title: 'Guardando…' },
      success: { title: 'Medición guardada' },
      error: { title: 'No se pudo guardar' },
    })
    ```
    Los textos siguen la voz definida (§9). No mezcles con `<Snackbar>` de MUI: los toasts son
    **siempre** Sileo, y los modales, **siempre** MUI `<Dialog>` (§8.8).

**Aprovecha React 19:** `ref` como prop (sin `forwardRef`); Actions + `useActionState` para
formularios; `useFormStatus` para estado de envío; `useOptimistic` para UI optimista; `use()` para
leer promesas/contexto; metadata de documento nativa.

**Checklist «el componente está terminado»:**

- [ ] Loading (skeleton, sin pantalla congelada) · Empty (ícono + mensaje + CTA) · Error (mensaje +
      Reintentar) · Parcial (aviso + tooltip) · Ideal (formato consistente + jerarquía).
- [ ] Anti doble-envío + validación estricta + sin `alert()` nativo.
- [ ] Selectores de Zustand, `onSnapshot` cancelado, accesible.

Si respondes "no" a cualquiera, **el componente no está terminado.**

---

## §9. Voz y tono / UX writing

**Voz de Mi tanque:** cercana y práctica. **Tuteamos** al usuario ("Elige tu tanque", "Ingresa las
pulgadas"), en español neutro, sin regionalismos. Hablamos de _pulgadas_, _galones_ y _litros_,
nunca de "volumen útil" ni términos de ingeniería. _(El texto heredado mezcla tú y usted; se unifica
al migrar cada pantalla.)_

1. **Define la voz una vez** y aplícala a **todo** el texto de cara al usuario: labels, botones,
   títulos, errores, toasts, vacíos, notificaciones, y respuestas de cualquier asistente/IA del
   backend.
2. **Lenguaje claro, cero jerga.** Habla el idioma del usuario, no el del dominio técnico.
3. **Mensajes de error humanos y accionables.** Di qué pasó y qué hacer, sin culpar. (Mal: _"Oops...
   La cantidad de pulgadas supera la capacidad del tanque!"_. Bien: _"Tu tanque mide 25 pulgadas de
   alto. Ingresa una medida entre 1 y 25."_)
4. **CTAs orientados a la acción** (`+ Agregar tanque`, `Guardar medición`), no genéricos (`OK`).
5. **Frases cortas y escaneables.** Emojis con moderación (💡 consejo, ⚠️ alerta, 🎉 logro).
6. **Regla de oro:** _"¿lo entendería alguien ajeno al dominio?"_ Si no, simplifícalo.

---

## §10. Estado global (Zustand)

1. **Stores por dominio** en `src/store/` (`auth`, `tanks`, `measurements`, etc.). Un store no es un
   cajón de sastre: agrupa estado y acciones de un mismo dominio.
2. **Suscripciones en vivo en el store, no en componentes sueltos.** El store abre el `onSnapshot`
   keyed por `activeAccountId`, expone `loading`/`error`, y **cancela** al cambiar de cuenta o
   desmontar. Los componentes leen del store.
3. **Selectores siempre** (`useStore(s => s.x)`) para minimizar re-renders; `getState()` para
   lecturas puntuales no reactivas (ej. dentro de un handler).
4. **Las mutaciones críticas pasan por un punto único** (ej. un hook `useMeasurementMutations`) que
   hace update optimista + rollback ante fallo de Firestore, en vez de escribir Firestore disperso por
   los componentes.
5. **No dupliques en el store lo que puedes derivar.** Calcula los valores derivados (galones del
   periodo, porcentaje de llenado) con selectores; guarda solo la fuente de verdad.

---

## §11. Testing y testeabilidad

1. **Diseña para testear.** Lógica de negocio (sobre todo la del backend) desacoplada de I/O
   (Firestore, red, UI). Funciones puras donde se pueda; inyecta dependencias.
2. **Prioriza por riesgo.** Lo crítico (el cálculo de combustible, permisos, idempotencia, casos
   borde) se testea sí o sí. No persigas un % de cobertura con tests triviales.
3. **Pirámide:** muchos unitarios, algunos de integración, pocos E2E (flujos críticos). **Prueba
   `firestore.rules` con el emulador de Firebase** — es la red de seguridad real.
4. **Cada bug corregido nace con un test de regresión.**
5. **Tests deterministas y aislados:** sin orden implícito, sin reloj real (inyecta el tiempo), sin
   red externa (mocks/emulador). Un test flaky se arregla o se borra.
6. **Testea casos borde explícitos:** vacío, null, límites de rango (0 pulgadas, tanque lleno),
   concurrencia, reintentos, entradas maliciosas.

---

## §12. Observabilidad y costos

1. **Logs estructurados** en Cloud Functions (`functions.logger` con clave-valor), no `console.log`
   sueltos; con request/op id y **sin datos sensibles** (la ubicación del usuario es un dato
   sensible).
2. **Monitoreo de errores en producción** con alertas en front y backend (decisión abierta 3 de §0).
3. **Vigila el costo de Firebase:** lecturas/escrituras por operación, invocaciones de funciones, y
   ancho de banda. Conoce el costo de tus operaciones frecuentes; mide antes de optimizar.
4. **Trabajo pesado fuera del camino crítico** (jobs en background / colas / triggers), no en el
   request que el usuario espera. Los efectos secundarios que el usuario no necesita esperar
   (desnormalizaciones, contadores, propagaciones, notificaciones) van en triggers.
5. **Cold starts sin costo fijo.** Nada que cobre 24/7 sin uso: `minInstances` no se usa por defecto
   y solo se activa con métricas de latencia que lo justifiquen y el costo mensual aprobado por el
   dueño. El cold start se ataca sin costo fijo, en este orden:
   1. **Sacarlo del camino del usuario:** lecturas directas (§2.9), efectos secundarios en triggers
      (§12.4) y un solo callable por acción del usuario.
   2. **Arranque liviano:** inicialización perezosa de lo que no usan todas las funciones y Firestore
      Admin con `preferRest: true`.
   3. **Menos funciones:** los callables interactivos de un mismo dominio, agrupados en uno solo.
   4. **Precalentar solo cuando se va a usar:** al abrir la pantalla o el formulario; si aún duele, un
      ping programado solo en horario laboral. Una instancia ociosa sin `minInstances` no se cobra,
      así que precalentar cuesta centavos.

   Mide la latencia en frío y en caliente antes y después de cada cambio. _(Implementación en
   §3.8.)_

---

## §13. Git, entornos y entrega

1. **Commits atómicos** con mensajes claros en imperativo, en formato _Conventional Commits_
   (`feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `test:`). Ramas por feature/fix;
   nunca directo sobre la principal. **PRs pequeños y revisables.**
2. **Rama principal siempre verde:** `tsc --noEmit` + lint + tests pasan antes de mergear
   (`npm run check` en local; la CI lo exige en cada push y PR).
3. **Configuración por variables de entorno** (`.env.local`), nunca hardcodeada. **`.env.example`
   actualizado** (sin valores reales) en cuanto exista la primera variable. Secretos en Secret
   Manager, no en `.env` commiteado. _(Las variables `VITE_*` terminan en el bundle: nunca son
   secretas.)_
4. **Deploy definido, con rollback.** Front y functions se despliegan por separado:
   - **Frontend → Vercel.** Deploy automático por push (preview por rama/PR, producción en `main`).
     Las variables de entorno se configuran en el dashboard de Vercel, **nunca** en el repo. Vercel
     guarda deploys previos: el rollback es promover el deploy anterior.
   - **Backend → `firebase deploy`** (`--only functions` / `firestore:rules,firestore:indexes`).
     Reglas e índices se despliegan al cambiarlos.
   - **Quién corre el deploy:** ver §0. La PWA cachea el build en el teléfono: tras cada deploy, los
     usuarios ven el aviso de nueva versión.
5. **Sin secretos, binarios ni generados en el repo.** `.gitignore` desde el primer commit.

---

## §14. Documentación

1. **README que arranca el proyecto en frío:** qué es, instalar, correr (incluido el emulador),
   testear, deployar.
2. **`CLAUDE.md`/`AGENTS.md`** con stack, reglas y convenciones, **apuntando a este archivo y a
   `DESIGN.md`**, para que la IA genere código alineado desde el primer prompt. _(En este repo,
   `AGENTS.md` es la fuente y `CLAUDE.md` la importa.)_
3. **`DESIGN.md` — fuente canónica del design system.** Documenta: paleta y tokens de color,
   tipografía (familias/escala), espaciado, radios y sombras, breakpoints, y las variantes/estados de
   los componentes base. Es el contrato visual del que se deriva el **theme de MUI**; la UI consume
   estos tokens, nunca valores hardcodeados (§8.13). Mantén `DESIGN.md` y el theme **en sincronía** —
   si cambia uno, cambia el otro.
4. **ADRs** para decisiones de arquitectura importantes (qué, alternativas, por qué), en
   `docs/adr/NNNN-titulo.md`.
5. **Documenta lo no obvio** (el _por qué_ y cómo se opera), no lo evidente.

---

## ✅ Definición de "terminado" (DoD)

- [ ] Cumple los principios aplicables de §1–§14 (o la excepción está justificada por escrito).
- [ ] TypeScript estricto, sin `any`, código completo; `tsc --noEmit` + lint + tests críticos en verde.
- [ ] Lecturas Firestore acotadas y filtradas por `accountId`; sin N+1; multi-doc atómico
      (`writeBatch`/`runTransaction`).
- [ ] Maneja los 5 estados de UI y previene doble-envío (si toca UI).
- [ ] **Toda mutación da feedback al usuario vía Sileo** (éxito y fallo); ninguna escritura silenciosa.
- [ ] Formularios con React Hook Form + Zod (`zodResolver`); esquema reutilizado en el callable.
- [ ] Fechas con `date-fns`; validación de objetos/arrays con `lodash-es` (named imports).
- [ ] Sin errores silenciosos: todo `catch` registra, reporta y da feedback.
- [ ] Validación en cliente **y** servidor/reglas; operaciones críticas idempotentes (`intentId`).
- [ ] Sin cold start evitable en el camino del usuario: lecturas directas (no callables), efectos
      secundarios en triggers, callable precalentado al abrir su pantalla; `minInstances` solo con
      el costo aprobado (§12.5).
- [ ] Sin secretos en el cliente ni en el repo; autorización en `firestore.rules`/callables.
- [ ] Texto de usuario en la voz definida; mensajes de error humanos.
- [ ] Estilos vía theme de MUI + tokens de `DESIGN.md`; sin hex ni píxeles mágicos en el JSX.
- [ ] `onSnapshot` cancelado al desmontar; selectores de Zustand; sin código muerto ni `console.log`
      de depuración.

---

> **Recordatorio de ejecución (antes de dar por buena una operación que toca datos):** _"¿Está plana
> y filtrada por `accountId`? ¿Es lo más barata posible en lecturas? ¿Es idempotente y segura?
> ¿Validé en el servidor/reglas? ¿Falla con gracia y avisa?"_ Si todo es sí, procede.
