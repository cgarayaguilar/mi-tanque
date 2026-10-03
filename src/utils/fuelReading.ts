import { calcFuelLevel } from 'utils/calcFuelLevel'
import { convertGallonsToLiters } from 'utils/converts'
import type { FuelReading, Tank } from 'types'

/** A tank of this phone, as the volume functions take it. */
export const localGeometry = (tank: Pick<Tank, 'diameter' | 'length'>) =>
  ({
    shape: 'cylinder',
    orientation: 'horizontal',
    dimensions: { diameterIn: tank.diameter, lengthIn: tank.length },
  }) as const

type LocalTank = Pick<Tank, 'diameter' | 'length'> &
  Partial<Pick<Tank, 'capacity' | 'catalogId'>>

/**
 * Gallons by shape times this give a catalog tank its capacity when full
 * (backend specs/0015 RF-9); 1 for the "Genérico" tanks and the user's own.
 * Only catalog tanks get a catalogId on this phone, so the catalog itself is
 * not loaded here: it stays out of the basic mode's first download.
 */
export const localScale = (tank: LocalTank) => {
  if (tank.catalogId === undefined || tank.capacity === undefined) return 1
  const full = calcFuelLevel({
    tankDiameter: tank.diameter,
    tankLength: tank.length,
    fuelHeight: tank.diameter,
  })
  return full > 0 ? tank.capacity / full : 1
}

/**
 * The reading shown and stored for a measured fuel height. Amounts are fixed
 * to 2 decimals, the format measurements have always been stored in.
 */
export const calculateReading = (
  tank: LocalTank,
  inches: number
): FuelReading => {
  const gallons =
    calcFuelLevel({
      tankDiameter: tank.diameter,
      tankLength: tank.length,
      fuelHeight: inches,
    }) * localScale(tank)
  const liters = convertGallonsToLiters({ gallons })

  return {
    inches,
    gallons: gallons.toFixed(2),
    liters: liters.toFixed(2),
    fuelHeight: ((inches / tank.diameter) * 100).toFixed(2),
  }
}
