# ADR 0002 — Marca Solo Camioneros y dominio solocamioneros.com

- **Estado:** Aceptado
- **Fecha:** 2026-10-01

## Contexto

La app se publicaba como "Mi tanque" en `mi-tanque.vercel.app`. El dueño la renombró a **Solo
Camioneros** y apuntó **solocamioneros.com** al mismo proyecto de Vercel. Viene además el modo
autenticado, con datos en Firestore, organizaciones y flotas (specs en `solocamioneros-backend`).

Los datos del modo básico viven en IndexedDB, que el navegador separa **por origen**: el dominio
nuevo empieza vacío para todos.

## Decisión

1. El nombre visible es **Solo Camioneros**: barra superior, título, manifest e icono instalado.
   El proyecto de Vercel y el repo conservan el nombre `mi-tanque`.
2. **solocamioneros.com es el dominio canónico.** `mi-tanque.vercel.app` redirige ahí, con el mismo
   path:
   - El servidor (`vercel.json`) redirige con 308 solo las navegaciones a páginas (cabecera
     `Sec-Fetch-Dest: document`). Los demás pedidos, incluido `sw.js`, se siguen sirviendo: si el
     service worker se redirigiera, el navegador rechazaría la actualización y las apps instaladas
     quedarían congeladas en la versión vieja.
   - La app (`src/utils/legacyHost.ts`) se manda sola al dominio nuevo cuando se abre en el viejo.
     Es lo que alcanza a las apps instaladas: su service worker responde las navegaciones sin
     preguntar al servidor, y tras "Actualizar" carga esta versión, que redirige.
3. **Se aceptan perdidos los datos locales del dominio viejo** (decisión del dueño). No hay
   exportación entre dominios. Los datos del modo básico en el dominio nuevo se podrán importar a la
   cuenta al iniciar sesión (fase 3 del backend).

## Consecuencias

- Quien tenga la app instalada desde el dominio viejo termina usando la web del dominio nuevo y
  debe reinstalarla desde solocamioneros.com.
- `short_name` del manifest también es "Solo Camioneros": algunos teléfonos lo recortan bajo el
  icono ("Solo Camion…"). Si molesta, se elige un nombre corto aparte.
- `www.solocamioneros.com` no resuelve todavía (DNS). Agregarlo en Vercel como redirección al
  dominio raíz es una tarea del dueño.
