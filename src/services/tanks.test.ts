import { db } from 'services/db'
import { createTank, readTanks, TankAlreadyExistsError } from 'services/tanks'

beforeEach(async () => {
  await db.tanks.clear()
})

test('createTank stores numeric dimensions even from form strings', async () => {
  const tank = await createTank({
    capacity: '80' as unknown as number,
    diameter: '22' as unknown as number,
    length: '50' as unknown as number,
  })

  expect(tank).toEqual({ id: tank.id, capacity: 80, diameter: 22, length: 50 })
  expect(await db.tanks.get(tank.id)).toEqual(tank)
})

test('createTank rejects dimensions outside the form limits', async () => {
  await expect(
    createTank({ capacity: 5, diameter: 22, length: 50 })
  ).rejects.toThrow()
  expect(await db.tanks.count()).toBe(0)
})

test('createTank rejects a duplicate and points to the existing tank', async () => {
  // Stored as strings by an older version: still the same tank
  const id = await db.tanks.add({
    capacity: '80',
    diameter: '22',
    length: '50',
  })

  const error: unknown = await createTank({
    capacity: 80,
    diameter: 22,
    length: 50,
  }).catch((reason: unknown) => reason)

  expect(error).toBeInstanceOf(TankAlreadyExistsError)
  expect((error as TankAlreadyExistsError).existing).toEqual({
    id,
    capacity: 80,
    diameter: 22,
    length: 50,
  })
  expect(await db.tanks.count()).toBe(1)
})

// The check and the insert share one transaction (§2.6)
test('concurrent saves of the same tank store it once', async () => {
  const dimensions = { capacity: 80, diameter: 22, length: 50 }

  const results = await Promise.allSettled([
    createTank(dimensions),
    createTank(dimensions),
  ])

  expect(results.map(result => result.status).sort()).toEqual([
    'fulfilled',
    'rejected',
  ])
  expect(await db.tanks.count()).toBe(1)
})

test('readTanks normalizes tanks stored with string dimensions', async () => {
  const id = await db.tanks.add({
    capacity: '80',
    diameter: '22',
    length: '50',
  })

  expect(await readTanks()).toEqual([
    { id, capacity: 80, diameter: 22, length: 50 },
  ])
})
