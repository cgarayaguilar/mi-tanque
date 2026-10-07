import {
  KM_PER_MILE,
  type FleetTank,
  type Trailer,
  type Truck,
} from 'schemas/fleet'
import { convertGallonsToLiters } from 'utils/converts'
import { isFactoryTemplate } from 'utils/tankTemplates'
import {
  capacityMismatch,
  capacityScale,
  fullVolumeGallons,
  gallonsAt,
  maxFuelHeight,
  type TankGeometry,
} from 'utils/tankVolume'

/** A fleet tank's reading, as stored in `measurements` (backend specs/0004). */
export interface CloudReading {
  inches: number
  gallons: number
  liters: number
  /** Share of the tank's volume by its dimensions, 0–100 (RF-3). */
  fillPercent: number
  /** The range with the truck's loaded efficiency (backend specs/0021). */
  estimate: RangeEstimate | null
  /** The range when empty; null without it, and in measurements from before. */
  estimateEmpty: RangeEstimate | null
}

export interface RangeEstimate {
  km: number
  miles: number
  kmPerGal: number
}

/** A truck's declared efficiencies, km/gal (backend specs/0021 RF-1). */
export interface Efficiencies {
  loaded: number | null
  empty: number | null
}

export const NO_EFFICIENCY: Efficiencies = { loaded: null, empty: null }

/** Loaded and empty, of the truck that estimates the range (if any). */
export const efficienciesOf = (
  truck: Truck | null | undefined
): Efficiencies => ({
  loaded: truck?.fuelEfficiencyKmPerGal ?? null,
  empty: truck?.fuelEfficiencyEmptyKmPerGal ?? null,
})

const round2 = (value: number) => Math.round(value * 100) / 100

export const geometryOf = (tank: FleetTank): TankGeometry =>
  tank.shape === 'cylinder'
    ? {
        shape: 'cylinder',
        orientation: tank.orientation,
        dimensions: tank.dimensions,
      }
    : {
        shape: tank.shape,
        orientation: tank.orientation,
        dimensions: tank.dimensions,
      }

/**
 * Gallons by shape times this make the full tank hold its capacity
 * (backend specs/0018 RF-3; specs/0015 RF-9 for factory tanks).
 */
export const capacityScaleOf = (tank: FleetTank) =>
  capacityScale(tank.capacityGal, fullVolumeGallons(geometryOf(tank)), {
    factory: isFactoryTemplate(tank.templateId),
  })

/** Measures and capacity of this tank disagree (specs/0018 RF-4). */
export const capacityMismatchOf = (tank: FleetTank) =>
  capacityMismatch(tank.capacityGal, fullVolumeGallons(geometryOf(tank)), {
    factory: isFactoryTemplate(tank.templateId),
  })

/** The tallest fuel height the form accepts for this tank (RF-2). */
export const maxInchesFor = (tank: FleetTank) => maxFuelHeight(geometryOf(tank))

/** The truck whose efficiency estimates this tank's range, if any (RF-3). */
export const rangeTruckFor = (
  tank: FleetTank,
  trucks: readonly Truck[],
  trailers: readonly Trailer[]
): Truck | null => {
  if (tank.equipment.kind === 'truck') {
    const { id } = tank.equipment
    return trucks.find(truck => truck.id === id) ?? null
  }
  if (tank.equipment.kind === 'trailer') {
    const { id } = tank.equipment
    const trailer = trailers.find(item => item.id === id)
    const hitched = trailer?.hitchedTruckId
    return hitched ? (trucks.find(truck => truck.id === hitched) ?? null) : null
  }
  return null
}

/** How far these gallons go at this efficiency; from unrounded gallons. */
const rangeFor = (
  gallons: number,
  kmPerGal: number | null
): RangeEstimate | null => {
  if (kmPerGal === null) return null
  const km = gallons * kmPerGal
  return {
    km: round2(km),
    miles: round2(km / KM_PER_MILE),
    kmPerGal: round2(kmPerGal),
  }
}

/** The reading of a height, with the range loaded and empty (RNF-1). */
export const readingFor = (
  tank: FleetTank,
  inches: number,
  efficiencies: Efficiencies
): CloudReading => {
  const geometry = geometryOf(tank)
  const byShape = gallonsAt(geometry, inches)
  const full = fullVolumeGallons(geometry)
  const gallons = byShape * capacityScaleOf(tank)
  return {
    inches,
    gallons: round2(gallons),
    liters: round2(convertGallonsToLiters({ gallons })),
    fillPercent: round2(Math.min(100, full > 0 ? (byShape / full) * 100 : 0)),
    estimate: rangeFor(gallons, efficiencies.loaded),
    estimateEmpty: rangeFor(gallons, efficiencies.empty),
  }
}
