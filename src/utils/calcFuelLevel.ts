import {
  convertInchesToMillimeters,
  convertLitersToGallons,
} from 'utils/converts'

interface FuelLevelInput {
  /** Inches. */
  tankDiameter: number
  /** Inches. */
  tankLength: number
  /** Measured fuel height, in inches. */
  fuelHeight: number
}

/**
 * Gallons of fuel in a horizontal cylindrical tank, from the area of the
 * circular segment the fuel fills times the tank length.
 */
export const calcFuelLevel = ({
  tankDiameter,
  tankLength,
  fuelHeight,
}: FuelLevelInput): number => {
  const radius = convertInchesToMillimeters({ inches: tankDiameter }) / 2000
  const length = convertInchesToMillimeters({ inches: tankLength }) / 1000
  const height = convertInchesToMillimeters({ inches: fuelHeight }) / 1000

  // Area of the circular segment of height `height` measured from the bottom
  const distanceFromCenter = radius - height
  const halfChord = Math.sqrt(radius ** 2 - distanceFromCenter ** 2)
  const angle = 2 * Math.asin(halfChord / radius)
  const segmentArea = (radius ** 2 * (angle - Math.sin(angle))) / 2

  // Liters, rounded to 2 decimals as the app always has
  const segmentLiters = Math.round(segmentArea * length * 100000) / 100
  const totalLiters = Math.round(Math.PI * radius ** 2 * length * 100000) / 100

  // Above the center the fuel fills everything except the empty top segment
  const fuelLiters =
    height <= radius ? segmentLiters : totalLiters - segmentLiters

  return convertLitersToGallons({ liters: fuelLiters })
}
