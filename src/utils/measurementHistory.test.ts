import type { Measurement, Tank } from 'types'
import { fillPercent, groupByTank } from 'utils/measurementHistory'

const small: Tank = { id: 1, capacity: 50, diameter: 25, length: 26 }
const large: Tank = { id: 2, capacity: 150, diameter: 24, length: 80 }

let nextId = 1
const measurement = (
  tankId: number,
  gallons: string,
  day: number
): Measurement => ({
  id: nextId++,
  tankId,
  gallons,
  liters: '0.00',
  inches: 10,
  fuelHeight: '40.00',
  location: 'Sin ubicación',
  date: new Date(2026, 8, day),
})

test('groups by tank with the newest measurement first', () => {
  const first = measurement(1, '40.00', 1)
  const second = measurement(1, '30.00', 2)

  const [history] = groupByTank([first, second], [small])

  expect(history?.measurements).toEqual([second, first])
})

test('summarizes each tank from its first to its last measurement', () => {
  const histories = groupByTank(
    [
      measurement(1, '40.00', 1),
      measurement(2, '100.00', 2),
      measurement(1, '30.50', 3),
      measurement(2, '120.00', 4),
    ],
    [small, large]
  )

  expect(
    histories.map(({ tank, firstGallons, lastGallons, change }) => ({
      id: tank.id,
      firstGallons,
      lastGallons,
      change,
    }))
  ).toEqual([
    // Most recently measured tank first
    { id: 2, firstGallons: 100, lastGallons: 120, change: 20 },
    { id: 1, firstGallons: 40, lastGallons: 30.5, change: -9.5 },
  ])
})

test('leaves out measurements of tanks that no longer exist', () => {
  expect(groupByTank([measurement(99, '10.00', 1)], [small])).toEqual([])
})

// specs/0018 RF-2, CA-2: readings stored with the height's percent are shown
// by volume, worked out again from their inches and tank
test('fillPercent is by volume, whatever was stored', () => {
  // 10 of 25 inches: 40% of the height, 37.35% of the volume
  expect(fillPercent(measurement(1, '10.00', 1), small)).toBe(37)
  expect(
    fillPercent({ ...measurement(1, '10.00', 1), fuelHeight: '' }, small)
  ).toBe(37)
  expect(
    fillPercent({ ...measurement(1, '10.00', 1), inches: 25 }, small)
  ).toBe(100)
  // Without inches, what was stored
  expect(
    fillPercent(
      { ...measurement(1, '10.00', 1), inches: Number.NaN, fuelHeight: '130' },
      small
    )
  ).toBe(100)
})
