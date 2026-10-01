import { registerSW } from 'virtual:pwa-register'
import { sileo } from 'sileo'

export default function registerServiceWorker(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Stays until the user updates or swipes it away: an update the user
      // never saw would leave them on the old version
      sileo.action({
        title: 'Nueva versión disponible',
        description: 'Actualiza para usar la última versión de la app.',
        duration: null,
        button: { title: 'Actualizar', onClick: () => void updateSW(true) },
      })
    },
    onOfflineReady() {
      sileo.success({ title: 'Lista para usarse sin conexión' })
    },
  })
}
