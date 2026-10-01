import { calcFuelLevel } from 'utils/calcFuelLevel'

// Volume of the fleet's tanks by shape and orientation (backend specs/0003,
// "Geometría y volumen"). Inches in, US gallons out.

export const TANK_SHAPES = [
  'cylinder',
  'rectangular',
  'd_flat_side',
  'd_flat_bottom',
] as const
export type TankShape = (typeof TANK_SHAPES)[number]

export const TANK_ORIENTATIONS = ['horizontal', 'vertical'] as const
export type TankOrientation = (typeof TANK_ORIENTATIONS)[number]

export interface CylinderDimensions {
  diameterIn: number
  lengthIn: number
}

/** Rectangular and D tanks: height and width of the cross-section, length. */
export interface BoxDimensions {
  heightIn: number
  widthIn: number
  lengthIn: number
}

export type TankGeometry =
  | {
      shape: 'cylinder'
      orientation: TankOrientation
      dimensions: CylinderDimensions
    }
  | {
      shape: 'rectangular' | 'd_flat_side' | 'd_flat_bottom'
      orientation: TankOrientation
      dimensions: BoxDimensions
    }

const CUBIC_INCHES_PER_GALLON = 231

/** Area of the circular segment of height h (0 ≤ h ≤ 2r), from the bottom. */
const circularSegment = (radius: number, h: number) =>
  radius ** 2 * Math.acos((radius - h) / radius) -
  (radius - h) * Math.sqrt(Math.max(0, 2 * radius * h - h ** 2))

/** Cross-section area filled up to h, for the tank lying on its length. */
const filledArea = (geometry: TankGeometry, h: number): number => {
  if (geometry.shape === 'cylinder') {
    const radius = geometry.dimensions.diameterIn / 2
    return circularSegment(radius, h)
  }

  const { heightIn: height, widthIn: width } = geometry.dimensions
  switch (geometry.shape) {
    case 'rectangular':
      return width * h
    case 'd_flat_side': {
      // Flat side against the chassis, outer side a half circle of radius H/2
      const radius = height / 2
      return (width - radius) * h + circularSegment(radius, h) / 2
    }
    case 'd_flat_bottom': {
      // Flat bottom, the top a half circle of radius W/2
      const radius = width / 2
      const straight = height - radius
      if (h <= straight) return width * h
      const t = Math.min(h - straight, radius)
      return (
        width * straight +
        t * Math.sqrt(radius ** 2 - t ** 2) +
        radius ** 2 * Math.asin(t / radius)
      )
    }
  }
}

/** The tallest fuel height that can be measured (the measuring form's limit). */
export const maxFuelHeight = (geometry: TankGeometry): number => {
  if (geometry.orientation === 'vertical') return geometry.dimensions.lengthIn
  return geometry.shape === 'cylinder'
    ? geometry.dimensions.diameterIn
    : geometry.dimensions.heightIn
}

const crossSectionHeight = (geometry: TankGeometry) =>
  geometry.shape === 'cylinder'
    ? geometry.dimensions.diameterIn
    : geometry.dimensions.heightIn

/** Gallons with the fuel at `inches` from the bottom (clamped to the tank). */
export const gallonsAt = (geometry: TankGeometry, inches: number): number => {
  const h = Math.min(Math.max(inches, 0), maxFuelHeight(geometry))

  if (geometry.orientation === 'vertical') {
    // Standing on its end: the whole cross-section times the fuel height
    const area = filledArea(geometry, crossSectionHeight(geometry))
    return (area * h) / CUBIC_INCHES_PER_GALLON
  }

  if (geometry.shape === 'cylinder') {
    // Unchanged: the calculation the app has always used (specs/0003)
    return calcFuelLevel({
      tankDiameter: geometry.dimensions.diameterIn,
      tankLength: geometry.dimensions.lengthIn,
      fuelHeight: h,
    })
  }

  return (
    (filledArea(geometry, h) * geometry.dimensions.lengthIn) /
    CUBIC_INCHES_PER_GALLON
  )
}

/** Gallons in the full tank, from its dimensions. */
export const fullVolumeGallons = (geometry: TankGeometry): number =>
  gallonsAt(geometry, maxFuelHeight(geometry))
