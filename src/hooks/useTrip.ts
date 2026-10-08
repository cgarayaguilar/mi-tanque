import { useEffect, useState } from 'react'
import type { Trip } from 'schemas/trips'
import { readTrip } from 'services/trips'
import { useTripsStore } from 'store/trips'
import { reportError } from 'utils/reportError'

// Imports the trips service statically: only lazy pages use this hook

export type LoadedTrip =
  | { status: 'loading' | 'missing' | 'error' }
  | {
      status: 'ready'
      trip: Trip
    }

/** A trip: from what the store knows, or read on its own (its screen). */
export const useTrip = (id: string | null): [LoadedTrip, () => void] => {
  const known = useTripsStore(state => (id ? state.known[id] : undefined))
  const remember = useTripsStore(state => state.remember)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<LoadedTrip>({ status: 'loading' })

  useEffect(() => {
    if (!id || known) return
    let current = true
    readTrip(id)
      .then(trip => {
        if (!current) return
        if (trip) remember(trip)
        else setLoaded({ status: 'missing' })
      })
      .catch((error: unknown) => {
        reportError(error, { operation: 'readTrip' })
        if (current) setLoaded({ status: 'error' })
      })
    return () => {
      current = false
    }
  }, [id, known, remember, attempt])

  return [
    known ? { status: 'ready', trip: known } : loaded,
    () => {
      setLoaded({ status: 'loading' })
      setAttempt(value => value + 1)
    },
  ]
}
