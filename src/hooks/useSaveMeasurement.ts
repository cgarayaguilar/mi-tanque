import { useRef, useState } from 'react'
import { sileo } from 'sileo'
import {
  createMeasurement,
  updateMeasurementLocation,
} from 'services/measurements'
import type { FuelReading, Tank } from 'types'
import { getCurrentPosition } from 'utils/getCurrentPosition'
import { reportError } from 'utils/reportError'
import { createRepeatGuard } from 'utils/repeatGuard'

const NO_LOCATION = 'Sin ubicación'

// The place name is optional: without it the measurement is still saved.
// Being offline is expected, so only failures while online are reported.
const findLocation = async (): Promise<string> => {
  const position = await getCurrentPosition()
  if (!position) return NO_LOCATION

  try {
    // import(): the place comes from our `geocode` function (specs/0008);
    // its small Firebase client loads only now, never with the app
    const { lookupPlace } = await import('services/placeLookup')
    return (await lookupPlace(position)) ?? NO_LOCATION
  } catch (error) {
    if (navigator.onLine) reportError(error, { operation: 'reverseGeocode' })
    return NO_LOCATION
  }
}

// Runs after the save: the GPS can take up to its timeout (or wait for the
// permission prompt) and geocoding needs the network, so the user never waits
// for them. If the app closes first, the measurement keeps "Sin ubicación".
const addLocation = async (measurementId: number) => {
  const location = await findLocation()
  if (location === NO_LOCATION) return

  try {
    await updateMeasurementLocation(measurementId, location)
  } catch (error) {
    reportError(error, { operation: 'updateMeasurementLocation' })
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
  const repeated = useRef(createRepeatGuard()).current

  return async (tank, reading) => {
    if (savingRef.current) return false
    // A double tap once the first save is done is not a new measurement
    if (repeated(`${String(tank.id)}|${String(reading.inches)}`)) return false
    savingRef.current = true
    const date = new Date()

    try {
      const measurementId = await createMeasurement({
        ...reading,
        date,
        location: NO_LOCATION,
        tankId: tank.id,
        intentId,
      })
      setIntentId(crypto.randomUUID())
      sileo.success({ title: 'Medición guardada' })
      void addLocation(measurementId)
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
