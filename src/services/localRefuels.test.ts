import { db } from 'services/db'
import {
  createLocalRefuel,
  lastLocalGallons,
  localStations,
  readLocalRefuelsInPeriod,
} from 'services/localRefuels'
import type { NewLocalRefuel } from 'types'

const DAY = 24 * 60 * 60 * 1000

const refuel = (overrides: Partial<NewLocalRefuel> = {}): NewLocalRefuel => ({
  intentId: crypto.randomUUID(),
  date: new Date(Date.now() - DAY),
  tankId: 1,
  gallonsAdded: 13.21,
  litersAdded: 50,
  quantityUnit: 'liter',
  currency: 'NIO',
  priceUnit: 'liter',
  pricePerGallon: 113.56,
  pricePerLiter: 30,
  total: 1500,
  inchesBefore: null,
  inchesAfter: null,
  gallonsBefore: 20,
  gallonsAfter: 33.21,
  fillPercentBefore: 40,
  fillPercentAfter: 66,
  stationName: 'Puma Km 7',
  ...overrides,
})

beforeEach(async () => {
  await db.refuels.clear()
  await db.measurements.clear()
})

test('saving the same intent twice keeps one refuel (§4.2)', async () => {
  const one = refuel()
  const first = await createLocalRefuel(one)
  const second = await createLocalRefuel(one)
  expect(second).toBe(first)
  expect(await db.refuels.count()).toBe(1)
})

test('the latest level is the newest of measurements and refuels with a level after (RF-3)', async () => {
  await db.measurements.add({
    date: new Date(Date.now() - 3 * DAY),
    inches: 10,
    gallons: '25.00',
    liters: '94.64',
    location: 'Sin ubicación',
    tankId: 1,
  })
  expect(await lastLocalGallons(1)).toBe(25)

  await createLocalRefuel(refuel({ date: new Date(Date.now() - 2 * DAY) }))
  expect(await lastLocalGallons(1)).toBe(33.21)

  // A newer refuel without a level after does not count
  await createLocalRefuel(
    refuel({ date: new Date(Date.now() - DAY), gallonsAfter: null })
  )
  expect(await lastLocalGallons(1)).toBe(33.21)
  expect(await lastLocalGallons(2)).toBeNull()
})

test('stations are suggested newest first, once each, ignoring case (RF-5)', async () => {
  await createLocalRefuel(
    refuel({ date: new Date(Date.now() - 3 * DAY), stationName: 'Uno' })
  )
  await createLocalRefuel(
    refuel({ date: new Date(Date.now() - 2 * DAY), stationName: 'Dos' })
  )
  await createLocalRefuel(
    refuel({ date: new Date(Date.now() - DAY), stationName: 'uno' })
  )
  await createLocalRefuel(refuel({ stationName: null }))
  expect(await localStations()).toEqual(['uno', 'Dos'])
})

test('the period returns its refuels newest first', async () => {
  await createLocalRefuel(
    refuel({ date: new Date(Date.now() - 2 * DAY), total: 1 })
  )
  await createLocalRefuel(
    refuel({ date: new Date(Date.now() - DAY), total: 2 })
  )
  await createLocalRefuel(
    refuel({ date: new Date(Date.now() - 40 * DAY), total: 3 })
  )
  const items = await readLocalRefuelsInPeriod({
    start: new Date(Date.now() - 7 * DAY),
    end: new Date(),
  })
  expect(items.map(item => item.total)).toEqual([2, 1])
})
