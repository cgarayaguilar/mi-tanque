import { useCallback, useEffect, useState } from 'react'
import {
  readTripMeasurements,
  type CloudMeasurement,
} from 'services/cloudMeasurements'
import { reportError } from 'utils/reportError'

// Imports the measurements service statically: only the trip's page (lazy)
// uses this hook

export type TripMeasurementsStatus = 'loading' | 'ready' | 'error'

/** A trip's measurements (backend specs/0042 RF-6), read when it opens. */
export const useTripMeasurements = (
  orgId: string,
  tripId: string
): [TripMeasurementsStatus, CloudMeasurement[], () => void] => {
  const [attempt, setAttempt] = useState(0)
  const key = `${orgId}|${tripId}|${String(attempt)}`
  const [read, setRead] = useState<{
    key: string
    status: TripMeasurementsStatus
    items: CloudMeasurement[]
  } | null>(null)

  useEffect(() => {
    if (!orgId || !tripId) return
    let current = true
    readTripMeasurements(orgId, tripId)
      .then(items => {
        if (current) setRead({ key, status: 'ready', items })
      })
      .catch((error: unknown) => {
        reportError(error, { operation: 'readTripMeasurements' })
        if (current) setRead({ key, status: 'error', items: [] })
      })
    return () => {
      current = false
    }
  }, [orgId, tripId, key])

  const retry = useCallback(() => {
    setAttempt(value => value + 1)
  }, [])
  return read?.key === key
    ? [read.status, read.items, retry]
    : ['loading', [], retry]
}
