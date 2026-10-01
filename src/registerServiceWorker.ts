import { registerSW } from 'virtual:pwa-register'
import { sileo } from 'sileo'

// duration: null would make Sileo skip its autopilot and show the toast
// collapsed, hiding the "Actualizar" button until the user taps it. A long
// finite duration with expand/collapse at 0 shows it expanded and keeps it
// that way. (Not "infinite": setTimeout overflows past ~24.8 days and would
// fire at once.) If left untouched, it is offered again on the next launch.
const UPDATE_NOTICE_DURATION_MS = 24 * 60 * 60 * 1000

export default function registerServiceWorker(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      sileo.action({
        title: 'Nueva versión disponible',
        description: 'Actualiza para usar la última versión de la app.',
        duration: UPDATE_NOTICE_DURATION_MS,
        autopilot: { expand: 0, collapse: 0 },
        button: { title: 'Actualizar', onClick: () => void updateSW(true) },
      })
    },
    onOfflineReady() {
      sileo.success({ title: 'Lista para usarse sin conexión' })
    },
  })
}
