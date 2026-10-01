import { db, type StoredTank } from 'services/db'
import { tankDimensionsSchema } from 'schemas/tank'
import type { Tank, TankDimensions } from 'types'

const toTank = (stored: StoredTank): Tank => {
  if (stored.id === undefined) throw new Error('Stored tank without id')

  return {
    id: stored.id,
    capacity: Number(stored.capacity),
    diameter: Number(stored.diameter),
    length: Number(stored.length),
  }
}

/** Domain error (§7.6): the user already has a tank with these dimensions. */
export class TankAlreadyExistsError extends Error {
  readonly existing: Tank

  constructor(existing: Tank) {
    super('A tank with these dimensions already exists')
    this.name = 'TankAlreadyExistsError'
    this.existing = existing
  }
}

const sameDimensions = (a: TankDimensions, b: TankDimensions) =>
  a.capacity === b.capacity &&
  a.diameter === b.diameter &&
  a.length === b.length

/**
 * Saves a tank and returns it normalized. The duplicate check and the insert
 * run in one read-write transaction, so two saves cannot both pass the check
 * (§2.6). Rejects with TankAlreadyExistsError, invalid data or storage errors.
 */
export const createTank = async (dimensions: TankDimensions): Promise<Tank> => {
  const valid = tankDimensionsSchema.parse(dimensions)

  return db.transaction('rw', db.tanks, async () => {
    const existing = (await db.tanks.toArray())
      .map(toTank)
      .find(tank => sameDimensions(tank, valid))
    if (existing) throw new TankAlreadyExistsError(existing)

    const id = await db.tanks.add(valid)
    return { id, ...valid }
  })
}

export const readTanks = async (): Promise<Tank[]> =>
  (await db.tanks.toArray()).map(toTank)

export const PREDEFINED_TANKS: TankDimensions[] = [
  { capacity: 50, diameter: 25, length: 26 },
  { capacity: 75, diameter: 24, length: 41 },
  { capacity: 75, diameter: 25, length: 39 },
  { capacity: 100, diameter: 23, length: 61 },
  { capacity: 100, diameter: 24, length: 54 },
  { capacity: 100, diameter: 26, length: 48 },
  { capacity: 110, diameter: 25, length: 57 },
  { capacity: 110, diameter: 26, length: 54 },
  { capacity: 120, diameter: 23, length: 73 },
  { capacity: 120, diameter: 24, length: 64 },
  { capacity: 125, diameter: 26, length: 59 },
  { capacity: 135, diameter: 26, length: 64 },
  { capacity: 140, diameter: 23, length: 85 },
  { capacity: 150, diameter: 24, length: 80 },
  { capacity: 150, diameter: 26, length: 71 },
]

// Check and insert inside one read-write transaction: IndexedDB serializes
// them, so concurrent first visits (two tabs, or StrictMode running effects
// twice) cannot seed the predefined tanks twice.
export const seedPredefinedTanks = (): Promise<void> =>
  db.transaction('rw', db.tanks, async () => {
    if ((await db.tanks.count()) === 0) {
      await db.tanks.bulkAdd(PREDEFINED_TANKS)
    }
  })
