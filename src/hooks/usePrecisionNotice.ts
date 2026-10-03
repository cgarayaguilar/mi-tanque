import { useEffect } from 'react'
import { sileo } from 'sileo'
import { hasHint } from 'store/session'
import { useSelectedTankStore } from 'store/selectedTank'
import { reportError } from 'utils/reportError'

const SEEN_KEY = 'precisionNotice0018'

/**
 * Once per phone, those who already measured are told that a full tank now
 * reads its capacity (backend specs/0018 RF-7): their next readings come out
 * up to ~10% lower than before. Someone new has nothing to compare with.
 */
export const usePrecisionNotice = () => {
  useEffect(() => {
    const returning =
      useSelectedTankStore.getState().selectedTank !== null || hasHint()
    try {
      if (window.localStorage.getItem(SEEN_KEY) !== null) return
    } catch (error) {
      // Without storage it would show on every visit: better not at all
      reportError(error, { operation: 'precisionNotice' })
      return
    }
    // The Toaster mounts after the page, so a toast sent from this effect
    // was lost: it goes out once the page is up. The mark is set then too,
    // so StrictMode's second run still shows it.
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(SEEN_KEY, 'seen')
      } catch (error) {
        reportError(error, { operation: 'precisionNotice' })
        return
      }
      if (!returning) return
      sileo.success({
        title: 'Mejoramos la precisión',
        description: 'Lleno ahora marca la capacidad de tu tanque.',
      })
    }, 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])
}
