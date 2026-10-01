import { useRef, useState } from 'react'
import { sileo } from 'sileo'
import { createMeasurement } from 'services/measurements'
import { getPlaceName } from 'services/geocoding'
import type { FuelReading, Tank } from 'types'
import { getCurrentPosition } from 'utils/getCurrentPosition'
import { reportError } from 'utils/reportError'

const NO_LOCATION = 'Sin ubicación'

// The place name is optional: without it the measurement is still saved.
// Being offline is expected, so only failures while online are reported.
const findLocation = async (): Promise<string> => {
  const position = await getCurrentPosition()
  if (!position) return NO_LOCATION

  try {
    return (await getPlaceName(position)) ?? NO_LOCATION
  } catch (error) {
    if (navigator.onLine) reportError(error, { operation: 'reverseGeocode' })
    return NO_LOCATION
  }
}

/**
 * The single place where a measurement is saved (§10.4). Resolves true when
 * it was saved; it reports failures and gives Sileo feedback either way.
 */
export const useSaveMeasurement = (): ((
  tank: Tank,
  reading: FuelReading
) => Promise<boolean>) => {
  // One id per measurement: retries of the same save reuse it, so it can never
  // be stored twice (§4.1). A new one is created after each successful save.
  const [intentId, setIntentId] = useState(() => crypto.randomUUID())
  // Blocks a second save before React re-renders the disabled button (§8.6)
  const savingRef = useRef(false)

  return async (tank, reading) => {
    if (savingRef.current) return false
    savingRef.current = true
    const date = new Date()

    try {
      const location = await findLocation()
      await createMeasurement({
        ...reading,
        date,
        location,
        tankId: tank.id,
        intentId,
      })
      setIntentId(crypto.randomUUID())
      sileo.success({ title: 'Medición guardada' })
      return true
    } catch (error) {
      reportError(error, { operation: 'createMeasurement', tankId: tank.id })
      sileo.error({
        title: 'No pudimos guardar la medición',
        description: 'Reintenta en un momento.',
      })
      return false
    } finally {
      savingRef.current = false
    }
  }
}
