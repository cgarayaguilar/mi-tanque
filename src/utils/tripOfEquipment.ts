import type { Trip } from 'schemas/trips'

// Which trips a measurement or refuel can go with, and which one it gets by
// default (backend specs/0042 RF-2): the same rule as the backend's
// activeTrip, for refuels from before (0027 RF-3)

export interface EquipmentRef {
  kind: 'none' | 'truck' | 'trailer'
  id: string | null
}

/** Whether a trip carries the truck or the trailer. */
const carries = (trip: Trip, equipment: EquipmentRef) =>
  (equipment.kind === 'truck' && trip.truckId === equipment.id) ||
  (equipment.kind === 'trailer' && trip.trailerId === equipment.id)

/**
 * The trips a tank's reading can go with: those carrying its truck or
 * trailer; any, for a tank without equipment.
 */
export const tripsForEquipment = (
  trips: readonly Trip[],
  equipment: EquipmentRef
) =>
  equipment.kind === 'none' || !equipment.id
    ? [...trips]
    : trips.filter(trip => carries(trip, equipment))

/**
 * The trip in progress of the truck or trailer at that time, the one that
 * started last; null without one, or without equipment.
 */
export const tripInProgress = (
  trips: readonly Trip[],
  equipment: EquipmentRef,
  at: Date
): Trip | null => {
  if (equipment.kind === 'none' || !equipment.id) return null
  return (
    trips
      .filter(
        trip =>
          trip.status === 'in_progress' &&
          carries(trip, equipment) &&
          trip.startAt.getTime() <= at.getTime() &&
          at.getTime() <= (trip.endAt?.getTime() ?? Number.POSITIVE_INFINITY)
      )
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())[0] ?? null
  )
}
