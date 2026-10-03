import { db, type StoredTank } from 'services/db'
import { parseTankDimensions, readTankDimensions } from 'schemas/tank'
import type { Tank, TankDimensions } from 'types'

const toTank = (stored: StoredTank): Tank => {
  if (stored.id === undefined) throw new Error('Stored tank without id')
  const dimensions = readTankDimensions(stored)
  if (dimensions === null) throw new Error('Stored tank without its measures')
  return {
    id: stored.id,
    ...dimensions,
    ...(stored.catalogId === undefined ? {} : { catalogId: stored.catalogId }),
  }
}

/** Tanks of this phone that can be read; one that cannot is left out. */
const readable = (stored: StoredTank[]) =>
  stored.filter(tank => readTankDimensions(tank) !== null).map(toTank)

/** Domain error (§7.6): the user already has a tank with these dimensions. */
export class TankAlreadyExistsError extends Error {
  readonly existing: Tank

  constructor(existing: Tank) {
    super('A tank with these dimensions already exists')
    this.name = 'TankAlreadyExistsError'
    this.existing = existing
  }
}

/** Same shape, position, measures and capacity (specs/0019 RF-11). */
export const sameDimensions = (a: TankDimensions, b: TankDimensions) =>
  a.capacity === b.capacity &&
  a.shape === b.shape &&
  a.orientation === b.orientation &&
  a.length === b.length &&
  (a.shape === 'cylinder'
    ? b.shape === 'cylinder' && a.diameter === b.diameter
    : b.shape !== 'cylinder' && a.height === b.height && a.width === b.width)

/**
 * Saves a tank and returns it normalized. The duplicate check and the insert
 * run in one read-write transaction, so two saves cannot both pass the check
 * (§2.6). Rejects with TankAlreadyExistsError, invalid data or storage errors.
 */
export const createTank = async (dimensions: TankDimensions): Promise<Tank> => {
  const valid = parseTankDimensions(dimensions)

  return db.transaction('rw', db.tanks, async () => {
    const existing = readable(await db.tanks.toArray()).find(tank =>
      sameDimensions(tank, valid)
    )
    if (existing) throw new TankAlreadyExistsError(existing)

    const id = await db.tanks.add(valid)
    return { id, ...valid }
  })
}

/**
 * A tank of the truck catalog as this phone's tank, of any shape (specs/0015
 * RF-11, specs/0019 RF-4):
 * the one already saved for it, a saved tank with its very dimensions (now
 * marked as the catalog's), or a new one. One read-write transaction.
 */
export const saveCatalogTank = async (
  catalogId: string,
  dimensions: TankDimensions
): Promise<Tank> => {
  const valid = parseTankDimensions(dimensions)
  return db.transaction('rw', db.tanks, async () => {
    const stored = readable(await db.tanks.toArray())
    const saved = stored.find(tank => tank.catalogId === catalogId)
    if (saved) return saved
    const same = stored.find(tank => sameDimensions(tank, valid))
    if (same) {
      await db.tanks.update(same.id, { catalogId })
      return { ...same, catalogId }
    }
    const id = await db.tanks.add({ ...valid, catalogId })
    return { id, ...valid, catalogId }
  })
}

export const readTanks = async (): Promise<Tank[]> =>
  readable(await db.tanks.toArray())

const genericCylinder = (
  capacity: number,
  diameter: number,
  length: number
): TankDimensions => ({
  capacity,
  shape: 'cylinder',
  orientation: 'horizontal',
  diameter,
  length,
})

export const PREDEFINED_TANKS: TankDimensions[] = [
  genericCylinder(50, 25, 26),
  genericCylinder(75, 24, 41),
  genericCylinder(75, 25, 39),
  genericCylinder(100, 23, 61),
  genericCylinder(100, 24, 54),
  genericCylinder(100, 26, 48),
  genericCylinder(110, 25, 57),
  genericCylinder(110, 26, 54),
  genericCylinder(120, 23, 73),
  genericCylinder(120, 24, 64),
  genericCylinder(125, 26, 59),
  genericCylinder(135, 26, 64),
  genericCylinder(140, 23, 85),
  genericCylinder(150, 24, 80),
  genericCylinder(150, 26, 71),
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
