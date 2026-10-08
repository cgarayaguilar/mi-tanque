import { useEffect, useMemo, useState } from 'react'
import { addDays, format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { routeName } from 'schemas/rates'
import type { Trip } from 'schemas/trips'
import { readTripsInPeriod } from 'services/trips'
import { useTripsStore } from 'store/trips'
import { reportError } from 'utils/reportError'

// The trips offered: those started up to 30 days around the expense
// (specs/0026 RF-10)
const NEAR_DAYS = 30

/** The trips around a day ('AAAA-MM-DD'), read when the day changes. */
const useTripsNear = (orgId: string, day: string | null) => {
  const [trips, setTrips] = useState<{ day: string; items: Trip[] } | null>(
    null
  )
  useEffect(() => {
    if (!day || !orgId) return
    let current = true
    const date = new Date(`${day}T12:00`)
    readTripsInPeriod(orgId, subDays(date, NEAR_DAYS), addDays(date, NEAR_DAYS))
      .then(page => {
        // Known by id: the one chosen is found again if the day moves
        const { remember } = useTripsStore.getState()
        for (const trip of page.items) remember(trip)
        if (current) setTrips({ day, items: page.items })
      })
      .catch((error: unknown) => {
        reportError(error, { operation: 'readTripsNear' })
        if (current) setTrips({ day, items: [] })
      })
    return () => {
      current = false
    }
  }, [orgId, day])
  return trips?.day === day ? trips.items : null
}

/**
 * The trips near a day, plus the ones the expense has or comes from,
 * newest first; null while they are read.
 */
export const useTripChoices = (
  orgId: string,
  day: string | null,
  extra: readonly (Trip | null)[]
) => {
  const near = useTripsNear(orgId, day)
  const [first, second, third] = extra
  const choices = useMemo(() => {
    const all = new Map<string, Trip>()
    // The ones just read win over a copy kept from before (audit 0027)
    for (const trip of [first, second, third, ...(near ?? [])]) {
      if (trip) all.set(trip.id, trip)
    }
    return [...all.values()].sort(
      (a, b) => b.startAt.getTime() - a.startAt.getTime()
    )
  }, [near, first, second, third])
  return { choices, loading: near === null }
}

/** "mar 6 oct · Managua → San José · Transportes Pérez" */
export const tripOption = (trip: Trip) => ({
  value: trip.id,
  label: `${format(trip.startAt, 'EEE d MMM', { locale: es })} · ${routeName(trip.origin, trip.destination)} · ${trip.clientName}`,
})
