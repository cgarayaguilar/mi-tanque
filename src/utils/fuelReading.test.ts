import { calculateReading } from 'utils/fuelReading'

test('builds the stored reading for a measured height', () => {
  expect(calculateReading({ diameter: 25, length: 26 }, 12)).toEqual({
    inches: 12,
    gallons: '26.22',
    liters: '99.25',
    fuelHeight: '48.00',
  })
})

test('a full tank reads 100%', () => {
  expect(calculateReading({ diameter: 25, length: 26 }, 25).fuelHeight).toBe(
    '100.00'
  )
})

// specs/0015 CA-6: without an account too, a catalog tank by its capacity
test('a catalog tank of this phone is adjusted; an old one is not', () => {
  const tank = { diameter: 24.5, length: 50, capacity: 100 }
  expect(
    calculateReading({ ...tank, catalogId: 'kw-c24.5x50-100' }, 24.5).gallons
  ).toBe('100.00')
  expect(Number(calculateReading(tank, 24.5).gallons)).toBeGreaterThan(101)
})
