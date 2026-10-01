import { db } from 'services/db'
import { createMeasurement } from 'services/measurements'
import type { NewMeasurement } from 'types'

const valid: NewMeasurement = {
  inches: 12,
  gallons: '26.22',
  liters: '99.25',
  fuelHeight: '48.00',
  date: new Date('2026-09-30T12:00:00Z'),
  location: 'Sin ubicación',
  tankId: 1,
}

beforeEach(async () => {
  await db.measurements.clear()
})

test('createMeasurement saves a valid measurement', async () => {
  const id = await createMeasurement(valid)

  expect(await db.measurements.get(id)).toEqual({ ...valid, id })
})

// Regression: a tank selected without id produced measurements without tank
test('createMeasurement rejects a measurement without a tank', async () => {
  await expect(
    createMeasurement({ ...valid, tankId: undefined as unknown as number })
  ).rejects.toThrow()
  expect(await db.measurements.count()).toBe(0)
})
