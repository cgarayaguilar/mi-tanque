import {
  convertGallonsToLiters,
  convertInchesToMillimeters,
  convertLitersToGallons,
  LITERS_PER_GALLON,
} from 'utils/converts'

// backend specs/0018 RF-8, CA-5: exact by definition, one value for the app
test('the conversions are exact', () => {
  expect(convertInchesToMillimeters({ inches: 1 })).toBe(25.4)
  expect(convertGallonsToLiters({ gallons: 1 })).toBe(3.785411784)
  expect(LITERS_PER_GALLON).toBe(3.785411784)
  expect(convertLitersToGallons({ liters: 3.785411784 })).toBe(1)
  // 200 gal: 757.08 liters, when measuring and in a refuel alike
  expect(convertGallonsToLiters({ gallons: 200 }).toFixed(2)).toBe('757.08')
})
