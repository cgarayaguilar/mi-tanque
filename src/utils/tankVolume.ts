import { calcFuelLevel, circularSegment } from 'utils/calcFuelLevel'
import { CUBIC_INCHES_PER_GALLON } from 'utils/converts'

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
    // The app's cylinder calculation (specs/0003), exact since specs/0018
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

// A capacity this far from the geometry suggests a measuring mistake
// (specs/0003 RF-10, shown by the preview of specs/0013 RF-8)
export const CAPACITY_TOLERANCE = 0.15

/** Whether the stated capacity agrees with the volume the measures give. */
export const capacityMatches = (volume: number, capacity: number) =>
  Math.abs(capacity - volume) / volume <= CAPACITY_TOLERANCE

/**
 * Gallons by measures times this make a full tank hold its capacity
 * (backend specs/0018 RF-3, RF-4): outside measures hold a bit more than the
 * tank does. Any tank whose measures and capacity agree is adjusted; one that
 * does not keeps its measures, since one of the two is wrong. A factory tank
 * is always adjusted (specs/0015 RF-9).
 */
export const capacityScale = (
  capacity: number | null | undefined,
  fullGallons: number,
  { factory = false }: { factory?: boolean } = {}
): number => {
  if (!capacity || capacity <= 0 || !(fullGallons > 0)) return 1
  return factory || capacityMatches(fullGallons, capacity)
    ? capacity / fullGallons
    : 1
}

/** Measures and capacity that disagree: the reading says so (RF-4). */
export const capacityMismatch = (
  capacity: number | null | undefined,
  fullGallons: number,
  { factory = false }: { factory?: boolean } = {}
): boolean =>
  !factory &&
  capacity != null &&
  capacity > 0 &&
  fullGallons > 0 &&
  !capacityMatches(fullGallons, capacity)
