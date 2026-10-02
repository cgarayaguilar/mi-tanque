import type { DistanceUnit } from 'schemas/fleet'

/**
 * The unit the organization reads distances in (backend specs/0010). One
 * from before it was a setting takes the unit most of its active trucks had
 * (RF-3); a tie or no trucks is km. Data is always stored in km.
 */
export const organizationDistanceUnit = (
  saved: DistanceUnit | null | undefined,
  trucks: readonly { distanceUnit: DistanceUnit; archived: boolean }[]
): DistanceUnit => {
  if (saved) return saved
  const active = trucks.filter(truck => !truck.archived)
  const miles = active.filter(truck => truck.distanceUnit === 'mi').length
  return miles > active.length - miles ? 'mi' : 'km'
}

export const DISTANCE_UNIT_OPTIONS = [
  { value: 'km', label: 'Kilómetros' },
  { value: 'mi', label: 'Millas' },
] as const
