import { FLEET_LIMITS } from 'schemas/fleet'
import { CURRENCIES } from 'schemas/account'
import type { LocalRefuel, Measurement, RefuelValues, Tank } from 'types'
import { formatNumber } from 'utils/formatNumber'
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

export interface ImportRefuel extends RefuelValues {
  id: string
  tankId: string
  tankName: string
  takenAt: Date
}

export interface ImportPlan {
  tanks: ImportTank[]
  measurements: ImportMeasurement[]
  /** Refuels of the basic mode (backend specs/0006 RF-14). */
  refuels: ImportRefuel[]
  /** Local records the rules would reject (out of range, bad date). */
  skipped: number
}

// Same text the basic mode stores when the GPS did not answer
const NO_LOCATION = 'Sin ubicación'
const LEGACY_PLACE_MAX = 120
const OLDEST = new Date(2020, 0, 1)
// The rules allow the phone clock up to 5 minutes ahead
const CLOCK_SKEW_MS = 5 * 60 * 1000

/** Who imports, where to and from which phone (RF-17, amended 2026-10-01). */
export interface ImportScope {
  orgId: string
  uid: string
  /** This phone's install (services/deviceId): local ids repeat across phones. */
  deviceId: string
}

/**
 * Deterministic per organization, person and phone: importing again writes
 * the same documents (RF-17). Without the organization a second one hit the
 * first one's documents; without the phone, a second phone's records were
 * taken as already imported.
 */
export const importId = (
  { orgId, uid, deviceId }: ImportScope,
  localId: number
) => `import-${orgId}-${uid}-${deviceId}-${String(localId)}`

/** Refuels get their own prefix: local ids repeat across tables. */
export const refuelImportId = (scope: ImportScope, localId: number) =>
  importId(scope, localId).replace(/-(\d+)$/, '-r$1')

/** The ids before the amendment, which earlier imports keep. */
export const legacyImportId = (uid: string, localId: number) =>
  `import-${uid}-${String(localId)}`
export const legacyRefuelImportId = (uid: string, localId: number) =>
  `import-${uid}-r${String(localId)}`

/**
 * The id of each local record. One already imported with the old id keeps
 * it, so importing again into that organization skips it, but only when it
 * is the same record (same tank measures, same date): the old id cannot
 * tell phones apart.
 */
export interface ImportIds {
  tank: (tank: Tank) => string
  measurement: (localId: number, takenAt: Date) => string
  refuel: (localId: number, takenAt: Date) => string
}

/** What identifies a record already in the organization. */
export const tankFingerprint = (tank: {
  capacityGal: number
  diameterIn: number
  lengthIn: number
}) =>
  `${String(tank.capacityGal)}|${String(tank.diameterIn)}|${String(tank.lengthIn)}`

export const importIdsFor = (
  scope: ImportScope,
  existing: {
    /** Fingerprints of this person's tanks in the organization, by id. */
    tanks: ReadonlyMap<string, string>
    /** Dates (ms) of their imported measurements and refuels, by id. */
    measurements: ReadonlyMap<string, number>
    refuels: ReadonlyMap<string, number>
  }
): ImportIds => {
  const pick = <T>(
    current: string,
    legacy: string,
    found: ReadonlyMap<string, T>,
    same: T
  ) => (found.get(legacy) === same ? legacy : current)
  return {
    tank: tank =>
      pick(
        importId(scope, tank.id),
        legacyImportId(scope.uid, tank.id),
        existing.tanks,
        tankFingerprint({
          capacityGal: tank.capacity,
          diameterIn: tank.diameter,
          lengthIn: tank.length,
        })
      ),
    measurement: (localId, takenAt) =>
      pick(
        importId(scope, localId),
        legacyImportId(scope.uid, localId),
        existing.measurements,
        takenAt.getTime()
      ),
    refuel: (localId, takenAt) =>
      pick(
        refuelImportId(scope, localId),
        legacyRefuelImportId(scope.uid, localId),
        existing.refuels,
        takenAt.getTime()
      ),
  }
}

const STATION_MAX = 60
const PRICE_PER_LITER_MAX = 1000
const PRICE_PER_GALLON_MAX = 3786
const TOTAL_MAX = 100_000_000

const withinOrNull = (value: number | null, max: number) =>
  value === null || (Number.isFinite(value) && value >= 0 && value <= max)

const inRange = (value: number, { min, max }: { min: number; max: number }) =>
  Number.isFinite(value) && value >= min && value <= max

const round2 = (value: number) => Math.round(value * 100) / 100

const validTank = (tank: Tank) =>
  inRange(tank.diameter, FLEET_LIMITS.section) &&
  inRange(tank.length, FLEET_LIMITS.tankLength) &&
  inRange(tank.capacity, FLEET_LIMITS.capacity)

export const planImport = (
  ids: ImportIds,
  localTanks: readonly Tank[],
  localMeasurements: readonly Measurement[],
  now = new Date(),
  localRefuels: readonly LocalRefuel[] = []
): ImportPlan => {
  const tanksById = new Map(
    localTanks.filter(validTank).map(tank => [tank.id, tank])
  )
  const used = new Map<number, ImportTank & { fullGallons: number }>()
  const measurements: ImportMeasurement[] = []
  const refuels: ImportRefuel[] = []
  let skipped = 0

  // Each local tank in use becomes one individual cylinder, once (RF-16)
  const cloudTankFor = (tank: Tank) => {
    const existing = used.get(tank.id)
    if (existing) return existing
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
    const cloudTank = {
      id: ids.tank(tank),
      // At most 2 decimals: the rules hold the name to 40 characters
      name: `Tanque de ${formatNumber(tank.capacity)} gal (importado)`,
      capacityGal: tank.capacity,
      diameterIn: tank.diameter,
      lengthIn: tank.length,
      templateId: template?.id ?? null,
      fullGallons: fullVolumeGallons(geometry),
    }
    used.set(tank.id, cloudTank)
    return cloudTank
  }
  const validDate = (date: Date) =>
    date >= OLDEST && date.getTime() <= now.getTime() + CLOCK_SKEW_MS

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
      validDate(takenAt)
    if (!valid) {
      skipped += 1
      continue
    }

    const cloudTank = cloudTankFor(tank)

    const place = local.location.trim()
    measurements.push({
      id: ids.measurement(local.id, takenAt),
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

  for (const local of localRefuels) {
    const tank = tanksById.get(local.tankId)
    const takenAt = new Date(local.date)
    const maxGallons = (tank?.capacity ?? 0) * 2
    const valid =
      tank !== undefined &&
      validDate(takenAt) &&
      local.gallonsAdded > 0 &&
      local.gallonsAdded <= maxGallons &&
      local.litersAdded > 0 &&
      local.litersAdded <= maxGallons * 3.785411784 &&
      (CURRENCIES as readonly string[]).includes(local.currency) &&
      local.pricePerLiter > 0 &&
      local.pricePerLiter <= PRICE_PER_LITER_MAX &&
      local.pricePerGallon > 0 &&
      local.pricePerGallon <= PRICE_PER_GALLON_MAX &&
      local.total >= 0 &&
      local.total <= TOTAL_MAX &&
      withinOrNull(local.inchesBefore, 600) &&
      withinOrNull(local.inchesAfter, 600) &&
      withinOrNull(local.gallonsBefore, maxGallons) &&
      withinOrNull(local.gallonsAfter, maxGallons) &&
      withinOrNull(local.fillPercentBefore, 100) &&
      withinOrNull(local.fillPercentAfter, 100) &&
      (local.stationName === null ||
        (local.stationName.length >= 1 &&
          local.stationName.length <= STATION_MAX))
    if (!valid) {
      skipped += 1
      continue
    }
    const cloudTank = cloudTankFor(tank)
    const {
      id,
      intentId: _intent,
      date: _date,
      tankId: _tank,
      ...values
    } = local
    refuels.push({
      ...values,
      id: ids.refuel(id, takenAt),
      tankId: cloudTank.id,
      tankName: cloudTank.name,
      takenAt,
    })
  }

  return {
    tanks: [...used.values()].map(({ fullGallons: _, ...tank }) => tank),
    measurements,
    refuels,
    skipped,
  }
}
