import { registerSW } from 'virtual:pwa-register'
import { updateAvailableAlert, offlineReadyAlert } from 'utils/alerts'

export default function registerServiceWorker() {
  const updateSW = registerSW({
    onNeedRefresh() {
      updateAvailableAlert().then(({ isConfirmed }) => {
        if (isConfirmed) updateSW(true)
      })
    },
    onOfflineReady() {
      offlineReadyAlert()
    },
  })
}
