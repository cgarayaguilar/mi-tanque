import { useEffect, useMemo, useState } from 'react'
import type { Trip } from 'schemas/trips'
import { readTripsByIds } from 'services/trips'
import { useTripsStore } from 'store/trips'
import { reportError } from 'utils/reportError'

// Imports the trips service statically: only Gastos (lazy) uses this hook

export type ExpenseTripsStatus = 'loading' | 'ready' | 'error'

/**
 * The trips of a period's expenses (backend specs/0043 RF-4, RF-5): the
 * ones already known, and the rest read once. Without signal, the ones it
 * could not read stay unknown and the status says so.
 */
export const useExpenseTrips = (orgId: string, tripIds: readonly string[]) => {
  const known = useTripsStore(state => state.known)
  // The ids read, or that failed, so each is asked once
  const [asked, setAsked] = useState<{
    key: string
    status: ExpenseTripsStatus
  } | null>(null)
  const missing = tripIds.filter(id => known[id]?.orgId !== orgId)
  const key = `${orgId}|${missing.join(',')}`

  useEffect(() => {
    const ids = key.split('|')[1]
    if (!orgId || !ids) return
    let current = true
    readTripsByIds(orgId, ids.split(','))
      .then(trips => {
        const { remember } = useTripsStore.getState()
        for (const trip of trips) remember(trip)
        if (current) setAsked({ key, status: 'ready' })
      })
      .catch((error: unknown) => {
        reportError(error, { operation: 'readExpenseTrips' })
        if (current) setAsked({ key, status: 'error' })
      })
    return () => {
      current = false
    }
  }, [orgId, key])

  const tripOf = useMemo(() => {
    const byId = new Map<string, Trip>(
      Object.values(known)
        .filter(trip => trip.orgId === orgId)
        .map(trip => [trip.id, trip])
    )
    return (id: string) => byId.get(id)
  }, [known, orgId])

  const status: ExpenseTripsStatus =
    missing.length === 0
      ? 'ready'
      : asked?.key === key
        ? asked.status
        : 'loading'
  return { tripOf, status }
}
