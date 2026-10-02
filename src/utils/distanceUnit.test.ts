import { organizationDistanceUnit } from 'utils/distanceUnit'

const truck = (distanceUnit: 'km' | 'mi', archived = false) => ({
  distanceUnit,
  archived,
})

// specs/0010 CA-2
test('without a saved unit, the one most active trucks have', () => {
  expect(
    organizationDistanceUnit(undefined, [truck('mi'), truck('mi'), truck('km')])
  ).toBe('mi')
  expect(
    organizationDistanceUnit(null, [truck('mi'), truck('km'), truck('km')])
  ).toBe('km')
  // Archived trucks do not count; a tie is km
  expect(
    organizationDistanceUnit(null, [
      truck('mi'),
      truck('km'),
      truck('mi', true),
    ])
  ).toBe('km')
  expect(organizationDistanceUnit(null, [])).toBe('km')
})

test('a saved unit wins', () => {
  expect(organizationDistanceUnit('km', [truck('mi'), truck('mi')])).toBe('km')
})
