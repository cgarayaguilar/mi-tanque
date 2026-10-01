import { db } from 'services/db'

export const createTank = async ({ capacity, diameter, length }) => {
  try {
    const newTank = await db.tanks.add({ capacity, diameter, length })

    return newTank
  } catch (err) {
    console.error(err)
  }
}

export const readTanks = async () => {
  const allTanks = await db.tanks.toArray()

  return allTanks
}

const PREDEFINED_TANKS = [
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
export const seedPredefinedTanks = () =>
  db.transaction('rw', db.tanks, async () => {
    if ((await db.tanks.count()) === 0) {
      await db.tanks.bulkAdd(PREDEFINED_TANKS)
    }
  })
