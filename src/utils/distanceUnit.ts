import { KM_PER_MILE, type DistanceUnit } from 'schemas/fleet'
import { formatNumber } from 'utils/formatNumber'

/**
 * The unit most of an organization's active trucks have: how one from
 * before specs/0010 gets its unit (RF-3) when the server cannot be asked.
 * A tie or no trucks is km.
 */
export const majorityUnit = (units: readonly unknown[]): DistanceUnit => {
  const miles = units.filter(unit => unit === 'mi').length
  return miles > units.length - miles ? 'mi' : 'km'
}

export const DISTANCE_UNIT_OPTIONS = [
  { value: 'km', label: 'Kilómetros' },
  { value: 'mi', label: 'Millas' },
] as const

/** An odometer stored in km, in the organization's unit: "120,500 km". */
export const odometerText = (km: number, unit: DistanceUnit) =>
  `${formatNumber(Math.round(unit === 'mi' ? km / KM_PER_MILE : km))} ${unit}`
