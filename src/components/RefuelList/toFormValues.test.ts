import { toFormValues, type RefuelItem } from 'components/RefuelList'
import { refuelAmounts } from 'utils/refuelMath'

const stored = (quantity: number, price: number): RefuelItem => ({
  ...refuelAmounts({
    quantity,
    quantityUnit: 'gallon',
    price,
    priceUnit: 'gallon',
  }),
  quantityUnit: 'gallon',
  priceUnit: 'gallon',
  currency: 'USD',
  inchesBefore: null,
  inchesAfter: null,
  gallonsBefore: null,
  gallonsAfter: null,
  fillPercentBefore: null,
  fillPercentAfter: null,
  stationName: null,
  id: 'r1',
  takenAt: new Date(2026, 9, 1),
  tankName: 'Tanque',
  equipmentName: null,
  userName: null,
  place: null,
  odometerKm: null,
  invoice: null,
})

// Regression: 45.123 gal at 3.999 stored a total of 180.45 but a quantity
// of 45.12 and a price of 4; editing prefilled 180.45 as a corrected total,
// which then stayed when the quantity changed
test('a computed total is not taken for a corrected one', () => {
  expect(toFormValues(stored(45.123, 3.999), 'km').total).toBe('')
})

test('a total the user corrected is kept', () => {
  const item = { ...stored(50, 30), total: 1499.5 }
  expect(toFormValues(item, 'km').total).toBe('1,499.5')
})
