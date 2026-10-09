import {
  TRIP_STATUS_LABELS,
  TRIP_STATUSES,
  tripIncome,
  type Trip,
  type TripStatus,
} from 'schemas/trips'
import { foldText, squeezeSpaces } from 'utils/foldText'
import { tripTotals } from 'utils/tripTotals'

// Filter, group and sort the trips of a period (backend specs/0030): pure,
// the list only shows what comes out of here (RNF-1)

export const TRIP_GROUPINGS = [
  'driver',
  'truck',
  'trailer',
  'client',
  'destination',
  'month',
  'week',
  'status',
] as const
export type TripGrouping = (typeof TRIP_GROUPINGS)[number]

export const TRIP_GROUPING_LABELS: Record<TripGrouping, string> = {
  driver: 'Conductor',
  truck: 'Camión',
  trailer: 'Remolque',
  client: 'Cliente',
  destination: 'Destino',
  month: 'Mes',
  week: 'Semana',
  status: 'Estado',
}

export const TRIP_ORDERS = [
  'dateDesc',
  'dateAsc',
  'priceDesc',
  'priceAsc',
] as const
export type TripOrder = (typeof TRIP_ORDERS)[number]

/** The first is the default (RF-7). */
export const TRIP_ORDER_LABELS: Record<TripOrder, string> = {
  dateDesc: 'Fecha, más reciente primero',
  dateAsc: 'Fecha, más antigua primero',
  priceDesc: 'Precio, mayor primero',
  priceAsc: 'Precio, menor primero',
}

export const DEFAULT_TRIP_ORDER: TripOrder = 'dateDesc'

export interface TripFilters {
  status: TripStatus | null
  clientId: string | null
  truckId: string | null
  driverId: string | null
  /** A destination's key (`destinationKey`). */
  destination: string | null
}

export const NO_TRIP_FILTERS: TripFilters = {
  status: null,
  clientId: null,
  truckId: null,
  driverId: null,
  destination: null,
}

/** "San José", "san jose" and "San  José" are one destination (RF-1). */
export const destinationKey = (destination: string) =>
  foldText(squeezeSpaces(destination))

/** The current name of an item of the fleet, or the one the trip saved. */
export type NameOf = (id: string, saved: string) => string

export interface TripNames {
  client: NameOf
  truck: NameOf
  trailer: NameOf
  driver: NameOf
}

export const filterTrips = (trips: readonly Trip[], filters: TripFilters) =>
  trips.filter(
    trip =>
      (filters.status === null || trip.status === filters.status) &&
      (filters.clientId === null || trip.clientId === filters.clientId) &&
      (filters.truckId === null || trip.truckId === filters.truckId) &&
      // Either of its two drivers (0025 RF-6)
      (filters.driverId === null ||
        trip.driverIds.includes(filters.driverId)) &&
      (filters.destination === null ||
        destinationKey(trip.destination) === filters.destination)
  )

/** Each destination of these trips once, as first written; A–Z. */
export const destinationOptions = (trips: readonly Trip[]) => {
  const spelled = new Map<string, string>()
  for (const trip of trips) {
    const key = destinationKey(trip.destination)
    if (!spelled.has(key)) spelled.set(key, squeezeSpaces(trip.destination))
  }
  return [...spelled]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

const newestFirst = (a: Trip, b: Trip) =>
  b.startAt.getTime() - a.startAt.getTime()

/** RF-7: by its start or by what its card shows; a tie, newest first. */
export const sortTrips = (trips: readonly Trip[], order: TripOrder) =>
  [...trips].sort((a, b) => {
    switch (order) {
      case 'dateDesc':
        return newestFirst(a, b)
      case 'dateAsc':
        return -newestFirst(a, b)
      case 'priceDesc':
        return tripIncome(b) - tripIncome(a) || newestFirst(a, b)
      case 'priceAsc':
        return tripIncome(a) - tripIncome(b) || newestFirst(a, b)
    }
  })

export interface TripGroup {
  key: string
  /** "Unidad 12", "octubre 2026", "del 5 oct al 11 oct", "En curso". */
  title: string
  trips: Trip[]
}

interface Membership {
  key: string
  title: string
  /** How the groups line up (RF-6). */
  rank: string | number
  /** After every other one: "Sin remolque". */
  last?: boolean
}

const NO_TRAILER = 'Sin remolque'

/** The groups a trip goes in: two for a trip with two drivers (RF-5). */
const membershipsOf = (
  trip: Trip,
  grouping: TripGrouping,
  names: TripNames
): Membership[] => {
  const named = (key: string, title: string) => ({
    key,
    title,
    rank: foldText(title),
  })
  switch (grouping) {
    case 'driver':
      return [
        named(trip.driverId, names.driver(trip.driverId, trip.driverName)),
        ...(trip.secondDriverId
          ? [
              named(
                trip.secondDriverId,
                names.driver(trip.secondDriverId, trip.secondDriverName ?? '')
              ),
            ]
          : []),
      ]
    case 'truck':
      return [named(trip.truckId, names.truck(trip.truckId, trip.truckName))]
    case 'trailer':
      return [
        trip.trailerId
          ? named(
              trip.trailerId,
              names.trailer(trip.trailerId, trip.trailerName ?? '')
            )
          : { key: '', title: NO_TRAILER, rank: '', last: true },
      ]
    case 'client':
      return [
        named(trip.clientId, names.client(trip.clientId, trip.clientName)),
      ]
    case 'destination':
      return [
        named(
          destinationKey(trip.destination),
          squeezeSpaces(trip.destination)
        ),
      ]
    case 'month':
      return [{ key: trip.yearMonth, title: trip.monthLabel, rank: '' }]
    case 'week':
      return [{ key: trip.weekStart, title: trip.weekLabel, rank: '' }]
    case 'status':
      return [
        {
          key: trip.status,
          title: TRIP_STATUS_LABELS[trip.status],
          rank: TRIP_STATUSES.indexOf(trip.status),
        },
      ]
  }
}

/**
 * The trips in groups, each one sorted (RF-5 to RF-7). Months and weeks
 * follow the dates: oldest first only when the order says so.
 */
export const groupTrips = (
  trips: readonly Trip[],
  grouping: TripGrouping,
  order: TripOrder,
  names: TripNames
): TripGroup[] => {
  const groups = new Map<string, Membership & { trips: Trip[] }>()
  for (const trip of trips) {
    for (const member of membershipsOf(trip, grouping, names)) {
      const group = groups.get(member.key) ?? { ...member, trips: [] }
      group.trips.push(trip)
      groups.set(member.key, group)
    }
  }
  const byDate = grouping === 'month' || grouping === 'week'
  const oldestFirst = order === 'dateAsc'
  return [...groups.values()]
    .sort((a, b) => {
      if (Boolean(a.last) !== Boolean(b.last)) return a.last ? 1 : -1
      if (byDate) {
        const sooner = a.key.localeCompare(b.key)
        return oldestFirst ? sooner : -sooner
      }
      if (typeof a.rank === 'number' && typeof b.rank === 'number')
        return a.rank - b.rank
      return String(a.rank).localeCompare(String(b.rank), 'es')
    })
    .map(({ key, title, trips }) => ({
      key,
      title,
      trips: sortTrips(trips, order),
    }))
}

/**
 * "3 viajes · C$75,000.00 NIO": the cancelled ones do not count, and each
 * currency adds up apart, as the totals above (RF-4).
 */
export const groupSummary = (trips: readonly Trip[]) => {
  const totals = tripTotals(trips)
  if (totals.count === 0) {
    return trips.length === 1
      ? '1 cancelado, no cuenta'
      : `${String(trips.length)} cancelados, no cuentan`
  }
  const count =
    totals.count === 1 ? '1 viaje' : `${String(totals.count)} viajes`
  return [count, ...totals.income].join(' · ')
}
