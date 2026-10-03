import { calcFuelLevel } from 'utils/calcFuelLevel'
import { convertGallonsToLiters } from 'utils/converts'
import { capacityMismatch, capacityScale } from 'utils/tankVolume'
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

/** Gallons in the full tank, by its measures. */
const fullByMeasures = (tank: LocalTank) =>
  calcFuelLevel({
    tankDiameter: tank.diameter,
    tankLength: tank.length,
    fuelHeight: tank.diameter,
  })

/**
 * Gallons by shape times this make the full tank hold its capacity (backend
 * specs/0018 RF-3; specs/0015 RF-9 for catalog tanks, which always are). Only
 * catalog tanks get a catalogId on this phone, so the catalog itself is not
 * loaded here: it stays out of the basic mode's first download.
 */
export const localScale = (tank: LocalTank) =>
  capacityScale(tank.capacity, fullByMeasures(tank), {
    factory: tank.catalogId !== undefined,
  })

/** Measures and capacity of this tank disagree (specs/0018 RF-4). */
export const localMismatch = (tank: LocalTank) =>
  capacityMismatch(tank.capacity, fullByMeasures(tank), {
    factory: tank.catalogId !== undefined,
  })

/**
 * How full the tank is at this height, by volume (specs/0018 RF-1): not by
 * height, which in a lying cylinder is off by up to 5.8 points.
 */
export const volumePercent = (
  tank: Pick<Tank, 'diameter' | 'length'>,
  inches: number
) => {
  const full = fullByMeasures(tank)
  if (!(full > 0)) return 0
  const gallons = calcFuelLevel({
    tankDiameter: tank.diameter,
    tankLength: tank.length,
    fuelHeight: inches,
  })
  return Math.min(100, (gallons / full) * 100)
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
    fuelHeight: volumePercent(tank, inches).toFixed(2),
  }
}
