import type { Ownership, Trailer, Truck } from 'schemas/fleet'
import type { Trip } from 'schemas/trips'

// Own or of a third party (backend specs/0035): what the app says and
// works out of it, in one place (RNF-2)

export const OWNERSHIP_LABELS: Record<Ownership, string> = {
  own: 'Propio',
  third_party: 'De un tercero',
}

export const OWNERSHIP_OPTIONS = (['own', 'third_party'] as const).map(
  value => ({ value, label: OWNERSHIP_LABELS[value] })
)

/** "De un tercero · Transportes López"; nothing for an own one (RF-4). */
export const ownershipLine = (item: Pick<Truck, 'ownership' | 'ownerName'>) =>
  item.ownership === 'third_party'
    ? [OWNERSHIP_LABELS.third_party, item.ownerName].filter(Boolean).join(' · ')
    : null

/**
 * Whose a trip's truck and trailer were: as the trip saved it, or, for a
 * trip from before, as they are now (RF-2). No trailer, null.
 */
export const tripOwnership = (
  trip: Pick<
    Trip,
    'truckId' | 'trailerId' | 'truckOwnership' | 'trailerOwnership'
  >,
  fleet: { trucks: readonly Truck[]; trailers: readonly Trailer[] }
): { truck: Ownership; trailer: Ownership | null } => ({
  truck:
    trip.truckOwnership ??
    fleet.trucks.find(item => item.id === trip.truckId)?.ownership ??
    'own',
  trailer:
    trip.trailerId === null
      ? null
      : (trip.trailerOwnership ??
        fleet.trailers.find(item => item.id === trip.trailerId)?.ownership ??
        'own'),
})

/** "Unidad 30 (de un tercero)" by the equipment that was (RF-7). */
export const thirdParty = (name: string | null, ownership: Ownership | null) =>
  name && ownership === 'third_party' ? `${name} (de un tercero)` : name
