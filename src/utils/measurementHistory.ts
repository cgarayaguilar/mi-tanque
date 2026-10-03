import type { Measurement, Tank } from 'types'
import { volumePercent } from 'utils/fuelReading'

export interface TankHistory {
  tank: Tank
  /** Newest first. */
  measurements: Measurement[]
  /** Gallons at the first and at the last measurement of the period. */
  firstGallons: number
  lastGallons: number
  /** Last minus first: negative when fuel was used, positive after a refill. */
  change: number
}

/**
 * Groups the measurements of a period by tank, most recently measured tank
 * first. Measurements of tanks that no longer exist are left out. Expects
 * the measurements oldest first, as `readMeasurementsInPeriod` returns them.
 */
export const groupByTank = (
  measurements: Measurement[],
  tanks: Tank[]
): TankHistory[] => {
  const byTank = new Map<number, Measurement[]>()
  for (const measurement of measurements) {
    const group = byTank.get(measurement.tankId) ?? []
    group.push(measurement)
    byTank.set(measurement.tankId, group)
  }

  const histories: TankHistory[] = []
  for (const tank of tanks) {
    const group = byTank.get(tank.id)
    const first = group?.[0]
    const last = group?.at(-1)
    if (!group || !first || !last) continue

    const firstGallons = Number(first.gallons)
    const lastGallons = Number(last.gallons)
    histories.push({
      tank,
      measurements: [...group].reverse(),
      firstGallons,
      lastGallons,
      change: lastGallons - firstGallons,
    })
  }

  const lastTime = (history: TankHistory) =>
    history.measurements[0]?.date.getTime() ?? 0
  return histories.sort((a, b) => lastTime(b) - lastTime(a))
}

/**
 * How full the tank was, by volume, rounded (backend specs/0018 RF-2). Worked
 * out again from the inches and the tank: readings stored before that spec
 * hold the percent of the height. Without both, what was stored.
 */
export const fillPercent = (measurement: Measurement, tank: Tank): number => {
  const percent =
    Number.isFinite(measurement.inches) && tank.diameter > 0
      ? volumePercent(tank, measurement.inches)
      : Number.parseFloat(measurement.fuelHeight)
  return Number.isFinite(percent)
    ? Math.min(100, Math.max(0, Math.round(percent)))
    : 0
}
