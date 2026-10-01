import { db } from 'services/db'
import { createTank, readTanks } from 'services/tanks'

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
