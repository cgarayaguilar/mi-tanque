import { calcFuelLevel } from 'utils/calcFuelLevel'
import {
  fullVolumeGallons,
  gallonsAt,
  maxFuelHeight,
  type TankGeometry,
} from 'utils/tankVolume'

// backend specs/0003 CA-5. Expected values computed by hand from the formulas
// in the spec (and checked against numeric integration when it was written).
const box = (
  shape: 'rectangular' | 'd_flat_side' | 'd_flat_bottom',
  orientation: 'horizontal' | 'vertical',
  heightIn: number,
  widthIn: number,
  lengthIn: number
): TankGeometry => ({
  shape,
  orientation,
  dimensions: { heightIn, widthIn, lengthIn },
})

const cylinder = (
  orientation: 'horizontal' | 'vertical',
  diameterIn: number,
  lengthIn: number
): TankGeometry => ({
  shape: 'cylinder',
  orientation,
  dimensions: { diameterIn, lengthIn },
})

const shapes: TankGeometry[] = [
  cylinder('horizontal', 25, 26),
  cylinder('vertical', 24, 48),
  box('rectangular', 'horizontal', 20, 24, 48),
  box('rectangular', 'vertical', 20, 24, 48),
  box('d_flat_side', 'horizontal', 24, 30, 48),
  box('d_flat_side', 'vertical', 24, 30, 48),
  box('d_flat_bottom', 'horizontal', 30, 24, 48),
  box('d_flat_bottom', 'vertical', 30, 24, 48),
]

test.each(shapes)(
  '$shape $orientation: empty is 0, full is the whole tank, and it only grows',
  geometry => {
    const max = maxFuelHeight(geometry)
    expect(gallonsAt(geometry, 0)).toBe(0)
    expect(gallonsAt(geometry, max)).toBeCloseTo(fullVolumeGallons(geometry), 6)

    let previous = 0
    for (let step = 1; step <= 40; step++) {
      const current = gallonsAt(geometry, (max * step) / 40)
      expect(current).toBeGreaterThan(previous)
      previous = current
    }
  }
)

test('the horizontal cylinder keeps the calculation the app always had', () => {
  for (const h of [0, 5, 12, 12.5, 20, 25]) {
    expect(gallonsAt(cylinder('horizontal', 25, 26), h)).toBe(
      calcFuelLevel({ tankDiameter: 25, tankLength: 26, fuelHeight: h })
    )
  }
  expect(fullVolumeGallons(cylinder('horizontal', 25, 26)).toFixed(2)).toBe(
    '55.25'
  )
})

test('a standing cylinder fills in a straight line', () => {
  const tank = cylinder('vertical', 24, 48)
  // π · 12² · 48 / 231
  expect(fullVolumeGallons(tank)).toBeCloseTo(94.0, 1)
  expect(gallonsAt(tank, 24)).toBeCloseTo(fullVolumeGallons(tank) / 2, 6)
  expect(maxFuelHeight(tank)).toBe(48)
})

test('a rectangular tank is width × length × height, in any orientation', () => {
  // 24 · 48 · 10 / 231
  expect(
    gallonsAt(box('rectangular', 'horizontal', 20, 24, 48), 10)
  ).toBeCloseTo(49.87, 2)
  expect(
    fullVolumeGallons(box('rectangular', 'horizontal', 20, 24, 48))
  ).toBeCloseTo(99.74, 2)
  expect(maxFuelHeight(box('rectangular', 'vertical', 20, 24, 48))).toBe(48)
})

test('D with a flat side: rectangle plus half a circle of radius H/2', () => {
  const tank = box('d_flat_side', 'horizontal', 24, 30, 48)
  // Cross-section areas (in²) from the spec's formula and numeric integration
  expect(gallonsAt(tank, 3)).toBeCloseTo((70.3192 * 48) / 231, 3)
  expect(gallonsAt(tank, 12)).toBeCloseTo((329.0973 * 48) / 231, 3)
  expect(gallonsAt(tank, 20)).toBeCloseTo((561.4148 * 48) / 231, 3)
  // (30 − 12) · 24 + π · 12² / 2 = 658.1947 in²
  expect(fullVolumeGallons(tank)).toBeCloseTo((658.1947 * 48) / 231, 3)
})

test('D with a flat bottom: straight up to H − W/2, then a half circle', () => {
  const tank = box('d_flat_bottom', 'horizontal', 30, 24, 48)
  expect(gallonsAt(tank, 5)).toBeCloseTo((120 * 48) / 231, 3)
  expect(gallonsAt(tank, 18)).toBeCloseTo((432 * 48) / 231, 3)
  expect(gallonsAt(tank, 25)).toBeCloseTo((589.9146 * 48) / 231, 3)
  expect(fullVolumeGallons(tank)).toBeCloseTo((658.1947 * 48) / 231, 3)
})

test('a standing D tank holds its cross-section times the fuel height', () => {
  const tank = box('d_flat_side', 'vertical', 24, 30, 48)
  expect(gallonsAt(tank, 10)).toBeCloseTo((658.1947 * 10) / 231, 3)
})

test('heights outside the tank are clamped', () => {
  const tank = box('rectangular', 'horizontal', 20, 24, 48)
  expect(gallonsAt(tank, -3)).toBe(0)
  expect(gallonsAt(tank, 99)).toBe(fullVolumeGallons(tank))
})
