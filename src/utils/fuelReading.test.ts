import { calculateReading } from 'utils/fuelReading'

test('builds the stored reading for a measured height', () => {
  expect(calculateReading({ diameter: 25, length: 26 }, 12)).toEqual({
    inches: 12,
    gallons: '26.22',
    liters: '99.25',
    // By volume (specs/0018 RF-1): by height it was 48.00
    fuelHeight: '47.45',
  })
})

test('a full tank reads 100%', () => {
  expect(calculateReading({ diameter: 25, length: 26 }, 25).fuelHeight).toBe(
    '100.00'
  )
})

// specs/0015 CA-6, specs/0018 RF-3: without an account too, full holds the
// tank's capacity
test('a catalog tank or one whose measures agree is adjusted', () => {
  const tank = { diameter: 24.5, length: 50, capacity: 100 }
  expect(
    calculateReading({ ...tank, catalogId: 'kw-c24.5x50-100' }, 24.5).gallons
  ).toBe('100.00')
  expect(calculateReading(tank, 24.5).gallons).toBe('100.00')
  // Measures that do not agree with the capacity: by the measures
  expect(
    Number(calculateReading({ ...tank, capacity: 60 }, 24.5).gallons)
  ).toBeGreaterThan(102)
})

// specs/0018 CA-1, CA-3
test('the percent is of the volume, and a Genérico full holds its capacity', () => {
  expect(
    calculateReading({ diameter: 24, length: 50, capacity: 100 }, 6).fuelHeight
  ).toBe('19.55')
  const generic = { diameter: 26, length: 48, capacity: 100 }
  expect(calculateReading(generic, 26)).toMatchObject({
    gallons: '100.00',
    fuelHeight: '100.00',
  })
  expect(calculateReading(generic, 13)).toMatchObject({
    gallons: '50.00',
    fuelHeight: '50.00',
  })
})

// specs/0018 RF-10, CA-6: heights outside the tank count as its ends
test('heights outside the tank are clamped, never NaN', () => {
  const tank = { diameter: 24, length: 50 }
  expect(calculateReading(tank, 24.000001).gallons).toBe(
    calculateReading(tank, 24).gallons
  )
  expect(calculateReading(tank, -1)).toMatchObject({
    gallons: '0.00',
    fuelHeight: '0.00',
  })
})
