import { convertGallonsToLiters } from 'utils/converts'
import {
  capacityMismatch,
  capacityScale,
  fullVolumeGallons,
  gallonsAt,
  maxFuelHeight,
  type TankGeometry,
} from 'utils/tankVolume'
import type { FuelReading, Tank, TankDimensions } from 'types'

// Without a capacity nothing is adjusted (each shape keeps its own fields)
type OptionalCapacity<T> = T extends unknown
  ? Omit<T, 'capacity'> & { capacity?: number }
  : never
type LocalTank = OptionalCapacity<TankDimensions> &
  Partial<Pick<Tank, 'catalogId'>>
type LocalShape = OptionalCapacity<TankDimensions>

/**
 * A tank of this phone as the volume functions take it, of any shape and
 * position (backend specs/0019 RF-7): the same formulas as the fleet's.
 */
export const localGeometry = (tank: LocalShape): TankGeometry =>
  tank.shape === 'cylinder'
    ? {
        shape: 'cylinder',
        orientation: tank.orientation,
        dimensions: { diameterIn: tank.diameter, lengthIn: tank.length },
      }
    : {
        shape: tank.shape,
        orientation: tank.orientation,
        dimensions: {
          heightIn: tank.height,
          widthIn: tank.width,
          lengthIn: tank.length,
        },
      }

/** The tallest fuel height this tank can be measured at, in inches. */
export const localMaxInches = (tank: LocalShape) =>
  maxFuelHeight(localGeometry(tank))

/**
 * Gallons by shape times this make the full tank hold its capacity (backend
 * specs/0018 RF-3; specs/0015 RF-9 for catalog tanks, which always are). Only
 * catalog tanks get a catalogId on this phone, so the catalog itself is not
 * loaded here: it stays out of the basic mode's first download.
 */
export const localScale = (tank: LocalTank) =>
  capacityScale(tank.capacity, fullVolumeGallons(localGeometry(tank)), {
    factory: tank.catalogId !== undefined,
  })

/** Measures and capacity of this tank disagree (specs/0018 RF-4). */
export const localMismatch = (tank: LocalTank) =>
  capacityMismatch(tank.capacity, fullVolumeGallons(localGeometry(tank)), {
    factory: tank.catalogId !== undefined,
  })

/**
 * How full the tank is at this height, by volume (specs/0018 RF-1): not by
 * height, which in a lying cylinder is off by up to 5.8 points.
 */
export const volumePercent = (tank: LocalShape, inches: number) => {
  const geometry = localGeometry(tank)
  const full = fullVolumeGallons(geometry)
  if (!(full > 0)) return 0
  return Math.min(100, (gallonsAt(geometry, inches) / full) * 100)
}

/**
 * The reading shown and stored for a measured fuel height. Amounts are fixed
 * to 2 decimals, the format measurements have always been stored in.
 * `fuelHeight` keeps its old name but holds the percent by volume (RF-1).
 */
export const calculateReading = (
  tank: LocalTank,
  inches: number
): FuelReading => {
  const gallons = gallonsAt(localGeometry(tank), inches) * localScale(tank)
  const liters = convertGallonsToLiters({ gallons })

  return {
    inches,
    gallons: gallons.toFixed(2),
    liters: liters.toFixed(2),
    fuelHeight: volumePercent(tank, inches).toFixed(2),
  }
}
