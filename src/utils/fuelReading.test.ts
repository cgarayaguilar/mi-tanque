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
