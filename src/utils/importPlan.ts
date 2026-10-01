import { FLEET_LIMITS } from 'schemas/fleet'
import type { Measurement, Tank } from 'types'
import { TANK_TEMPLATES } from 'utils/tankTemplates'
import { fullVolumeGallons, type TankGeometry } from 'utils/tankVolume'

/**
 * What importing the basic mode writes (backend specs/0004 RF-16, RF-17).
 * Pure: the service reads IndexedDB, plans with this and writes Firestore.
 */
export interface ImportTank {
  id: string
  name: string
  capacityGal: number
  diameterIn: number
  lengthIn: number
  templateId: string | null
}

export interface ImportMeasurement {
  id: string
  tankId: string
  tankName: string
  takenAt: Date
  inches: number
  gallons: number
  liters: number
  fillPercent: number
  legacyPlace: string | null
}

export interface ImportPlan {
  tanks: ImportTank[]
  measurements: ImportMeasurement[]
  /** Local measurements the rules would reject (out of range, bad date). */
  skipped: number
}

// Same text the basic mode stores when the GPS did not answer
const NO_LOCATION = 'Sin ubicación'
const LEGACY_PLACE_MAX = 120
const OLDEST = new Date(2020, 0, 1)
// The rules allow the phone clock up to 5 minutes ahead
const CLOCK_SKEW_MS = 5 * 60 * 1000

/** Deterministic: importing again writes the same documents (RF-17). */
export const importId = (uid: string, localId: number) =>
  `import-${uid}-${String(localId)}`

const inRange = (value: number, { min, max }: { min: number; max: number }) =>
  Number.isFinite(value) && value >= min && value <= max

const round2 = (value: number) => Math.round(value * 100) / 100

const validTank = (tank: Tank) =>
  inRange(tank.diameter, FLEET_LIMITS.section) &&
  inRange(tank.length, FLEET_LIMITS.tankLength) &&
  inRange(tank.capacity, FLEET_LIMITS.capacity)

export const planImport = (
  uid: string,
  localTanks: readonly Tank[],
  localMeasurements: readonly Measurement[],
  now = new Date()
): ImportPlan => {
  const tanksById = new Map(
    localTanks.filter(validTank).map(tank => [tank.id, tank])
  )
  const used = new Map<number, ImportTank & { fullGallons: number }>()
  const measurements: ImportMeasurement[] = []
  let skipped = 0

  for (const local of localMeasurements) {
    const tank = tanksById.get(local.tankId)
    const gallons = Number(local.gallons)
    const liters = Number(local.liters)
    const takenAt = new Date(local.date)
    const valid =
      tank !== undefined &&
      Number.isFinite(local.inches) &&
      local.inches > 0 &&
      local.inches <= tank.diameter &&
      inRange(gallons, { min: 0, max: tank.capacity * 2 }) &&
      inRange(liters, { min: 0, max: tank.capacity * 2 * 3.785411784 }) &&
      takenAt >= OLDEST &&
      takenAt.getTime() <= now.getTime() + CLOCK_SKEW_MS
    if (!valid) {
      skipped += 1
      continue
    }

    let cloudTank = used.get(tank.id)
    if (!cloudTank) {
      const geometry: TankGeometry = {
        shape: 'cylinder',
        orientation: 'horizontal',
        dimensions: { diameterIn: tank.diameter, lengthIn: tank.length },
      }
      const template = TANK_TEMPLATES.find(
        item =>
          item.capacityGal === tank.capacity &&
          item.diameterIn === tank.diameter &&
          item.lengthIn === tank.length
      )
      cloudTank = {
        id: importId(uid, tank.id),
        name: `Tanque de ${String(tank.capacity)} gal (importado)`,
        capacityGal: tank.capacity,
        diameterIn: tank.diameter,
        lengthIn: tank.length,
        templateId: template?.id ?? null,
        fullGallons: fullVolumeGallons(geometry),
      }
      used.set(tank.id, cloudTank)
    }

    const place = local.location.trim()
    measurements.push({
      id: importId(uid, local.id),
      tankId: cloudTank.id,
      tankName: cloudTank.name,
      takenAt,
      inches: local.inches,
      gallons,
      liters,
      // By volume, like the cloud measurements (RF-3)
      fillPercent: round2(
        Math.min(100, (gallons / cloudTank.fullGallons) * 100)
      ),
      legacyPlace:
        place === '' || place === NO_LOCATION
          ? null
          : place.slice(0, LEGACY_PLACE_MAX),
    })
  }

  return {
    tanks: [...used.values()].map(({ fullGallons: _, ...tank }) => tank),
    measurements,
    skipped,
  }
}
