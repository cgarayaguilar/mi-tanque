import { majorityUnit } from 'utils/distanceUnit'

// specs/0010 CA-2
test('the unit most trucks have; a tie or none is km', () => {
  expect(majorityUnit(['mi', 'mi', 'km'])).toBe('mi')
  expect(majorityUnit(['mi', 'km', 'km'])).toBe('km')
  expect(majorityUnit(['mi', 'km'])).toBe('km')
  expect(majorityUnit([])).toBe('km')
})

// Audit 2026-10-02: the history rows said "km" in an organization in miles
test('an odometer reads in the organization unit', async () => {
  const { odometerText } = await import('utils/distanceUnit')
  expect(odometerText(160934, 'mi')).toBe('100,000 mi')
  expect(odometerText(120500, 'km')).toBe('120,500 km')
})
