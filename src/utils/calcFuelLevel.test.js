import { calcFuelLevel } from 'utils/calcFuelLevel'

// Characterization test: locks the gallons the app has always shown, rounded
// like the UI does (toFixed(2)). Known values were checked in the app UI.
const gallons = (tankDiameter, tankLength, fuelHeight) =>
  calcFuelLevel({ tankDiameter, tankLength, fuelHeight }).toFixed(2)

test('an empty tank holds no fuel', () => {
  expect(gallons(25, 26, 0)).toMatchInlineSnapshot(`"0.00"`)
})

test('partial levels below and above the tank center', () => {
  expect(gallons(25, 26, 12)).toMatchInlineSnapshot(`"26.22"`)
  expect(gallons(25, 26, 15)).toMatchInlineSnapshot(`"34.61"`)
  expect(gallons(24, 41, 10)).toMatchInlineSnapshot(`"31.67"`)
  expect(gallons(24, 41, 20)).toMatchInlineSnapshot(`"71.50"`)
})

test('half the diameter is half the full volume', () => {
  expect(Number(gallons(25, 26, 12.5)) * 2).toBeCloseTo(
    Number(gallons(25, 26, 25)),
    1
  )
})

test('a full tank holds its full volume', () => {
  expect(gallons(25, 26, 25)).toMatchInlineSnapshot(`"55.25"`)
})
