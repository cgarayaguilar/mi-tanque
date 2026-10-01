import { useState } from 'react'
import { sileo } from 'sileo'
import { useCloudHistoryStore } from 'store/cloudHistory'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import { reportError } from 'utils/reportError'

/** Per organization and phone: 'done' or 'dismissed' (specs/0004 RF-15). */
export const importOfferKey = (orgId: string) => `importOffer:${orgId}`

export const rememberImportOffer = (
  orgId: string,
  answer: 'done' | 'dismissed'
) => {
  try {
    localStorage.setItem(importOfferKey(orgId), answer)
  } catch {
    // Private mode without storage: the offer may show again, nothing breaks
  }
}

export const importOfferAnswered = (orgId: string) => {
  try {
    return localStorage.getItem(importOfferKey(orgId)) !== null
  } catch {
    return false
  }
}

const measurementsText = (count: number) =>
  count === 1 ? '1 medición' : `${String(count)} mediciones`

const refuelsText = (count: number) =>
  count === 1 ? '1 relleno' : `${String(count)} rellenos`

/** "5 mediciones y 2 rellenos", leaving out what is zero. */
export const recordsText = (measurements: number, refuels: number) =>
  [
    measurements > 0 && measurementsText(measurements),
    refuels > 0 && refuelsText(refuels),
  ]
    .filter(Boolean)
    .join(' y ')

/** Imports this phone's basic-mode data into the active organization. */
export const useImportLocalData = () => {
  const [importing, setImporting] = useState(false)
  const orgId = useSessionStore(state => state.organization?.id ?? null)
  const uid = useSessionStore(state => state.user?.uid ?? null)
  const userName = useSessionStore(
    state => state.profile?.displayName ?? state.user?.displayName ?? ''
  )

  /** Resolves true when the import finished. */
  const run = async (): Promise<boolean> => {
    if (importing || !orgId || !uid) return false
    // The writes wait for the server: offline they would never finish
    if (!navigator.onLine) {
      sileo.warning({
        title: 'Necesitas conexión para importar',
        description: 'Conéctate a internet y vuelve a intentarlo.',
      })
      return false
    }
    setImporting(true)
    try {
      const { importLocalData } = await import('services/importLocal')
      const { measurements, refuels, skipped } = await importLocalData({
        orgId,
        uid,
        userName: userName || 'Sin nombre',
      })
      rememberImportOffer(orgId, 'done')
      sileo.success({
        title:
          measurements + refuels === 0
            ? 'Ya estaba todo importado'
            : `Importamos ${recordsText(measurements, refuels)}`,
        description:
          skipped === 1
            ? '1 registro no se pudo pasar porque sus datos están fuera de rango.'
            : skipped > 1
              ? `${String(skipped)} registros no se pudieron pasar porque sus datos están fuera de rango.`
              : 'Los ves en Historial con su fecha original, y sus tanques en Flota.',
      })
      void useFleetStore.getState().load(orgId)
      if (useCloudHistoryStore.getState().orgId === orgId) {
        void useCloudHistoryStore.getState().load(orgId)
      }
      return true
    } catch (error) {
      reportError(error, { operation: 'importLocalData' })
      sileo.error({
        title: 'No pudimos importar tus datos',
        description:
          'Lo que alcanzó a subirse no se duplica. Vuelve a intentarlo.',
      })
      return false
    } finally {
      setImporting(false)
    }
  }

  return { importing, run }
}
