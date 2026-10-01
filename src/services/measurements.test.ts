import { db } from 'services/db'
import {
  createMeasurement,
  readMeasurementsInPeriod,
  updateMeasurementLocation,
} from 'services/measurements'
import type { NewMeasurement } from 'types'

const valid: NewMeasurement = {
  inches: 12,
  gallons: '26.22',
  liters: '99.25',
  fuelHeight: '48.00',
  date: new Date('2026-09-30T12:00:00Z'),
  location: 'Sin ubicación',
  tankId: 1,
  intentId: '3f2b8c1e-5d4a-4e7b-9c6f-1a2b3c4d5e6f',
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

// Regression: a double tap on "Calcular" stored the measurement twice
test('createMeasurement stores one measurement per intent', async () => {
  const [first, second] = await Promise.all([
    createMeasurement(valid),
    createMeasurement(valid),
  ])
  const retry = await createMeasurement(valid)

  expect(second).toBe(first)
  expect(retry).toBe(first)
  expect(await db.measurements.count()).toBe(1)
})

test('createMeasurement stores different intents separately', async () => {
  await createMeasurement(valid)
  await createMeasurement({
    ...valid,
    intentId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  })

  expect(await db.measurements.count()).toBe(2)
})

test('measurements saved before intent ids existed still coexist', async () => {
  const { intentId: _omitted, ...legacy } = valid
  await db.measurements.bulkAdd([legacy, legacy])

  await createMeasurement(valid)

  expect(await db.measurements.count()).toBe(3)
})

test('readMeasurementsInPeriod returns the period oldest first, both days included', async () => {
  const at = (day: number, hour: number) => new Date(2026, 8, day, hour)
  const { intentId: _omitted, ...base } = valid
  await db.measurements.bulkAdd([
    { ...base, date: at(30, 23) },
    { ...base, date: at(23, 0) },
    { ...base, date: at(22, 23) },
  ])

  const measurements = await readMeasurementsInPeriod({
    start: at(23, 0),
    end: new Date(2026, 8, 30, 23, 59, 59, 999),
  })

  expect(measurements.map(({ date }) => date)).toEqual([at(23, 0), at(30, 23)])
})

test('readMeasurementsInPeriod normalizes amounts stored as numbers', async () => {
  const { intentId: _omitted, fuelHeight: _missing, ...base } = valid
  await db.measurements.add({
    ...base,
    gallons: 26.2,
    liters: 99.25,
    tankId: '1',
  })

  const [measurement] = await readMeasurementsInPeriod({
    start: new Date('2026-09-30T00:00:00Z'),
    end: new Date('2026-09-30T23:59:59Z'),
  })

  expect(measurement).toMatchObject({
    gallons: '26.20',
    liters: '99.25',
    fuelHeight: '',
    tankId: 1,
  })
})

test('updateMeasurementLocation adds the place name later', async () => {
  const id = await createMeasurement({ ...valid, location: 'Sin ubicación' })

  await updateMeasurementLocation(id, 'Managua, Nicaragua')

  expect(await db.measurements.get(id)).toMatchObject({
    location: 'Managua, Nicaragua',
  })
})
