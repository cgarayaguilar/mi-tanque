// Refuels without an account (backend specs/0006): on this phone, in IndexedDB.
import { db } from 'services/db'
import type { LocalRefuel, NewLocalRefuel, Period, RefuelValues } from 'types'

const MAX_STATIONS = 50

/** Saves a refuel once per intent and returns its id (§4.2). */
export const createLocalRefuel = (refuel: NewLocalRefuel): Promise<number> =>
  db.transaction('rw', db.refuels, async () => {
    const existing = await db.refuels
      .where('intentId')
      .equals(refuel.intentId)
      .first()
    return existing?.id ?? db.refuels.add(refuel)
  })

const toRefuel = (
  stored: { id?: number } & NewLocalRefuel
): LocalRefuel | null =>
  stored.id === undefined ? null : { ...stored, id: stored.id }

/** Refuels within the period, newest first. */
export const readLocalRefuelsInPeriod = async ({
  start,
  end,
}: Period): Promise<LocalRefuel[]> =>
  (
    await db.refuels
      .where('date')
      .between(start, end, true, true)
      .reverse()
      .toArray()
  )
    .map(toRefuel)
    .filter((refuel): refuel is LocalRefuel => refuel !== null)

export const readAllLocalRefuels = async (): Promise<LocalRefuel[]> =>
  (await db.refuels.toArray())
    .map(toRefuel)
    .filter((refuel): refuel is LocalRefuel => refuel !== null)

export const updateLocalRefuel = async (
  id: number,
  changes: RefuelValues
): Promise<void> => {
  await db.refuels.update(id, changes)
}

export const deleteLocalRefuel = (id: number): Promise<void> =>
  db.refuels.delete(id)

/**
 * The latest level of a local tank (RF-3): its newest measurement or the
 * level after its newest refuel, whichever is more recent.
 */
export const lastLocalGallons = async (
  tankId: number
): Promise<number | null> => {
  const [measurements, refuels] = await Promise.all([
    db.measurements.where('tankId').equals(tankId).toArray(),
    db.refuels.where('tankId').equals(tankId).toArray(),
  ])
  const readings = [
    ...measurements.map(m => ({
      date: new Date(m.date),
      gallons: Number(m.gallons),
    })),
    ...refuels
      .filter(r => r.gallonsAfter !== null)
      .map(r => ({ date: new Date(r.date), gallons: r.gallonsAfter ?? 0 })),
  ].filter(reading => Number.isFinite(reading.gallons))
  readings.sort((a, b) => b.date.getTime() - a.date.getTime())
  return readings[0]?.gallons ?? null
}

/** Stations used on this phone, most recent first (RF-5). */
export const localStations = async (): Promise<string[]> => {
  const refuels = await db.refuels.orderBy('date').reverse().toArray()
  const names: string[] = []
  for (const { stationName } of refuels) {
    const name = stationName?.trim()
    if (
      name &&
      !names.some(other => other.toLowerCase() === name.toLowerCase())
    ) {
      names.push(name)
      if (names.length === MAX_STATIONS) break
    }
  }
  return names
}
