import { db } from 'services/db'
import { createTank, readTanks, TankAlreadyExistsError } from 'services/tanks'
import { cylinder } from '../testing/localTank'

beforeEach(async () => {
  await db.tanks.clear()
})

test('createTank stores numeric dimensions even from form strings', async () => {
  const tank = await createTank(
    cylinder({
      capacity: '80' as unknown as number,
      diameter: '22' as unknown as number,
      length: '50' as unknown as number,
    })
  )

  expect(tank).toEqual(
    cylinder({ id: tank.id, capacity: 80, diameter: 22, length: 50 })
  )
  expect(await db.tanks.get(tank.id)).toEqual(tank)
})

test('createTank rejects dimensions outside the form limits', async () => {
  await expect(
    createTank(cylinder({ capacity: 5, diameter: 22, length: 50 }))
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

  const error: unknown = await createTank(
    cylinder({ capacity: 80, diameter: 22, length: 50 })
  ).catch((reason: unknown) => reason)

  expect(error).toBeInstanceOf(TankAlreadyExistsError)
  // Stored before specs/0019, without a shape: a lying cylinder
  expect((error as TankAlreadyExistsError).existing).toEqual(
    cylinder({ id, capacity: 80, diameter: 22, length: 50 })
  )
  expect(await db.tanks.count()).toBe(1)
})

// The check and the insert share one transaction (§2.6)
test('concurrent saves of the same tank store it once', async () => {
  const dimensions = cylinder({ capacity: 80, diameter: 22, length: 50 })

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

  // No shape either: a lying cylinder (specs/0019 RF-2)
  expect(await readTanks()).toEqual([
    cylinder({ id, capacity: 80, diameter: 22, length: 50 }),
  ])
})
