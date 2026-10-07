import {
  capacityMismatchOf,
  maxInchesFor,
  rangeTruckFor,
  efficienciesOf,
  NO_EFFICIENCY,
  readingFor,
} from 'utils/measurementMath'
import { fullVolumeGallons, gallonsAt } from 'utils/tankVolume'
import { tank, trailer, truck } from '../testing/fleetFixtures'

// backend specs/0004 CA-2
const dTank = tank() // D, flat side, 24 × 30 × 48, on truck-1

test('a D tank at 12 inches: gallons from its formula, % by volume, km by the truck', () => {
  const reading = readingFor(dTank, 12, { loaded: 9.5, empty: null })
  const geometry = {
    shape: 'd_flat_side',
    orientation: 'horizontal',
    dimensions: { heightIn: 24, widthIn: 30, lengthIn: 48 },
  } as const
  // Its 135 gal agree with the 136.77 its measures give: adjusted to them
  // (specs/0018 RF-3)
  const expected = (gallonsAt(geometry, 12) * 135) / fullVolumeGallons(geometry)

  expect(reading.gallons).toBeCloseTo(expected, 2)
  expect(reading.liters).toBeCloseTo(expected * 3.785411784, 2)
  // 329.0973 / 658.1947 of the cross-section: exactly half the volume
  expect(reading.fillPercent).toBe(50)
  expect(reading.estimate?.km).toBeCloseTo(expected * 9.5, 1)
  expect(reading.estimate?.miles).toBeCloseTo((expected * 9.5) / 1.609344, 1)
})

// backend specs/0021 CA-2: the same gallons at 8.5 loaded and 11 empty
test('the range loaded and empty come from the same gallons', () => {
  // Half of a 130 gal tank (its measures agree: adjusted to it)
  const half = readingFor(
    { ...dTank, capacityGal: 130 },
    12,
    efficienciesOf(
      truck({ fuelEfficiencyKmPerGal: 8.5, fuelEfficiencyEmptyKmPerGal: 11 })
    )
  )
  expect(half.gallons).toBe(65)
  expect(half.estimate).toEqual({ km: 552.5, miles: 343.31, kmPerGal: 8.5 })
  expect(half.estimateEmpty).toEqual({ km: 715, miles: 444.28, kmPerGal: 11 })
  // A truck saved before specs/0021: the loaded one only
  expect(
    readingFor(dTank, 12, efficienciesOf(truck())).estimateEmpty
  ).toBeNull()
})

test('without efficiency there is no estimate; full is 100%', () => {
  const reading = readingFor(dTank, 24, NO_EFFICIENCY)
  expect(reading.estimate).toBeNull()
  expect(reading.estimateEmpty).toBeNull()
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
    expect(readingFor(kenworth, 24.5, NO_EFFICIENCY).gallons).toBe(100)
    const half = readingFor(kenworth, 12, NO_EFFICIENCY)
    expect(half.gallons).toBeGreaterThan(48)
    expect(half.gallons).toBeLessThan(49.5)
    // The share of the tank does not change
    expect(half.fillPercent).toBe(
      readingFor({ ...kenworth, templateId: null }, 12, NO_EFFICIENCY)
        .fillPercent
    )
  })

  // specs/0018 RF-3, CA-3: any tank whose measures and capacity agree
  test('a "Genérico" or one typed by hand: full holds its capacity too', () => {
    for (const templateId of ['cyl-100-24x54', null, 'not-a-template']) {
      const generic = tank({
        shape: 'cylinder',
        dimensions: { diameterIn: 24, lengthIn: 54 },
        capacityGal: 100,
        templateId,
      })
      expect(readingFor(generic, 24, NO_EFFICIENCY).gallons).toBe(100)
      expect(readingFor(generic, 12, NO_EFFICIENCY)).toMatchObject({
        gallons: 50,
        fillPercent: 50,
      })
      expect(capacityMismatchOf(generic)).toBe(false)
    }
  })

  // specs/0018 RF-4, CA-4: measures and capacity that disagree
  test('a tank whose capacity does not fit its measures keeps its measures', () => {
    const geometry = {
      shape: 'cylinder' as const,
      orientation: 'horizontal' as const,
      dimensions: { diameterIn: 26, lengthIn: 48 },
    }
    const wrong = tank({
      shape: 'cylinder',
      dimensions: { diameterIn: 26, lengthIn: 48 },
      capacityGal: 70,
      templateId: null,
    })
    expect(readingFor(wrong, 26, NO_EFFICIENCY).gallons).toBe(
      Math.round(fullVolumeGallons(geometry) * 100) / 100
    )
    expect(capacityMismatchOf(wrong)).toBe(true)
    // A factory tank is always adjusted, and never "disagrees"
    expect(
      capacityMismatchOf({ ...wrong, templateId: 'kw-c24.5x50-100' })
    ).toBe(false)
  })
})
