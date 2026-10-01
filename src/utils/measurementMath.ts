import {
  KM_PER_MILE,
  type FleetTank,
  type Trailer,
  type Truck,
} from 'schemas/fleet'
import { convertGallonsToLiters } from 'utils/converts'
import {
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
  estimate: { km: number; miles: number; kmPerGal: number } | null
}

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

export const readingFor = (
  tank: FleetTank,
  inches: number,
  kmPerGal: number | null
): CloudReading => {
  const geometry = geometryOf(tank)
  const gallons = gallonsAt(geometry, inches)
  const full = fullVolumeGallons(geometry)
  const km = kmPerGal === null ? null : gallons * kmPerGal
  return {
    inches,
    gallons: round2(gallons),
    liters: round2(convertGallonsToLiters({ gallons })),
    fillPercent: round2(Math.min(100, full > 0 ? (gallons / full) * 100 : 0)),
    estimate:
      km === null || kmPerGal === null
        ? null
        : {
            km: round2(km),
            miles: round2(km / KM_PER_MILE),
            kmPerGal: round2(kmPerGal),
          },
  }
}
