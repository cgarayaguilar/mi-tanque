import { maxInchesFor, rangeTruckFor, readingFor } from 'utils/measurementMath'
import { gallonsAt } from 'utils/tankVolume'
import { tank, trailer, truck } from '../testing/fleetFixtures'

// backend specs/0004 CA-2
const dTank = tank() // D, flat side, 24 × 30 × 48, on truck-1

test('a D tank at 12 inches: gallons from its formula, % by volume, km by the truck', () => {
  const reading = readingFor(dTank, 12, 9.5)
  const expected = gallonsAt(
    {
      shape: 'd_flat_side',
      orientation: 'horizontal',
      dimensions: { heightIn: 24, widthIn: 30, lengthIn: 48 },
    },
    12
  )

  expect(reading.gallons).toBeCloseTo(expected, 2)
  expect(reading.liters).toBeCloseTo(expected * 3.785, 1)
  // 329.0973 / 658.1947 of the cross-section: exactly half the volume
  expect(reading.fillPercent).toBe(50)
  expect(reading.estimate?.km).toBeCloseTo(expected * 9.5, 1)
  expect(reading.estimate?.miles).toBeCloseTo((expected * 9.5) / 1.609344, 1)
})

test('without efficiency there is no estimate; full is 100%', () => {
  const reading = readingFor(dTank, 24, null)
  expect(reading.estimate).toBeNull()
  expect(reading.fillPercent).toBe(100)
})

test('the range comes from the truck, the hitched truck, or nobody', () => {
  const trucks = [truck()]
  const trailers = [
    trailer({ id: 'trailer-1', hitchedTruckId: 'truck-1' }),
    trailer({ id: 'loose', hitchedTruckId: null }),
  ]

  expect(rangeTruckFor(dTank, trucks, trailers)?.id).toBe('truck-1')
  expect(
    rangeTruckFor(
      tank({ equipment: { kind: 'trailer', id: 'trailer-1' } }),
      trucks,
      trailers
    )?.id
  ).toBe('truck-1')
  expect(
    rangeTruckFor(
      tank({ equipment: { kind: 'trailer', id: 'loose' } }),
      trucks,
      trailers
    )
  ).toBeNull()
  expect(
    rangeTruckFor(
      tank({ equipment: { kind: 'none', id: null } }),
      trucks,
      trailers
    )
  ).toBeNull()
})

test('the inches limit follows the shape and position', () => {
  expect(maxInchesFor(dTank)).toBe(24)
  expect(maxInchesFor(tank({ orientation: 'vertical' }))).toBe(48)
  expect(
    maxInchesFor(
      tank({
        shape: 'cylinder',
        dimensions: { diameterIn: 25, lengthIn: 26 },
      } as never)
    )
  ).toBe(25)
})

// specs/0015 CA-4: a factory tank is measured with its capacity
describe('a catalog tank is adjusted to its factory capacity', () => {
  const kenworth = tank({
    shape: 'cylinder',
    dimensions: { diameterIn: 24.5, lengthIn: 50 },
    capacityGal: 100,
    templateId: 'kw-c24.5x50-100',
  })

  test('full, it holds its capacity; half way, about half', () => {
    expect(readingFor(kenworth, 24.5, null).gallons).toBe(100)
    const half = readingFor(kenworth, 12, null)
    expect(half.gallons).toBeGreaterThan(48)
    expect(half.gallons).toBeLessThan(49.5)
    // The share of the tank does not change
    expect(half.fillPercent).toBe(
      readingFor({ ...kenworth, templateId: null }, 12, null).fillPercent
    )
  })

  test('a "Genérico", one typed by hand or an edited one: as always', () => {
    const geometry = {
      shape: 'cylinder' as const,
      orientation: 'horizontal' as const,
      dimensions: { diameterIn: 24, lengthIn: 54 },
    }
    const byShape = Math.round(gallonsAt(geometry, 12) * 100) / 100
    for (const templateId of ['cyl-100-24x54', null, 'not-a-template']) {
      const generic = tank({
        shape: 'cylinder',
        dimensions: { diameterIn: 24, lengthIn: 54 },
        capacityGal: 100,
        templateId,
      })
      expect(readingFor(generic, 12, null).gallons).toBe(byShape)
    }
  })
})
