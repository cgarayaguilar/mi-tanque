import { calcFuelLevel } from 'utils/calcFuelLevel'
import { convertGallonsToLiters } from 'utils/converts'
import type { FuelReading, TankDimensions } from 'types'

/**
 * The reading shown and stored for a measured fuel height. Amounts are fixed
 * to 2 decimals, the format measurements have always been stored in.
 */
export const calculateReading = (
  tank: Pick<TankDimensions, 'diameter' | 'length'>,
  inches: number
): FuelReading => {
  const gallons = calcFuelLevel({
    tankDiameter: tank.diameter,
    tankLength: tank.length,
    fuelHeight: inches,
  })
  const liters = convertGallonsToLiters({ gallons })

  return {
    inches,
    gallons: gallons.toFixed(2),
    liters: liters.toFixed(2),
    fuelHeight: ((inches / tank.diameter) * 100).toFixed(2),
  }
}
