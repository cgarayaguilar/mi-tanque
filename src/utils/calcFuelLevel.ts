import { CUBIC_INCHES_PER_GALLON } from 'utils/converts'

/**
 * Area of the circular segment of height h, measured from the bottom of a
 * circle of the given radius. Heights outside 0–2r count as the nearest end
 * (backend specs/0018 RF-10), and float noise at the ends stays in range.
 */
export const circularSegment = (radius: number, h: number): number => {
  const height = Math.min(Math.max(h, 0), 2 * radius)
  const cosine = Math.min(Math.max((radius - height) / radius, -1), 1)
  return (
    radius ** 2 * Math.acos(cosine) -
    (radius - height) *
      Math.sqrt(Math.max(0, 2 * radius * height - height ** 2))
  )
}

interface FuelLevelInput {
  /** Inches. */
  tankDiameter: number
  /** Inches. */
  tankLength: number
  /** Measured fuel height, in inches. */
  fuelHeight: number
}

/**
 * Gallons of fuel in a horizontal cylindrical tank: the circular segment the
 * fuel fills times the tank length. In inches and exact gallons, rounded only
 * when shown or stored (specs/0018 RF-9).
 */
export const calcFuelLevel = ({
  tankDiameter,
  tankLength,
  fuelHeight,
}: FuelLevelInput): number =>
  (circularSegment(tankDiameter / 2, fuelHeight) * tankLength) /
  CUBIC_INCHES_PER_GALLON
