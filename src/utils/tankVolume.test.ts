import { calcFuelLevel } from 'utils/calcFuelLevel'
import {
  capacityMismatch,
  capacityScale,
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

// ---- backend specs/0018 RF-12: every shape against numeric integration ----
// An independent reference: the width of the cross-section at each height,
// integrated by Simpson's rule, with the exact 231 cubic inches per gallon.

const widthAt = (g: TankGeometry, y: number): number => {
  const half = (r: number, center: number) =>
    Math.sqrt(Math.max(0, r * r - (y - center) ** 2))
  if (g.shape === 'cylinder') {
    const r = g.dimensions.diameterIn / 2
    return 2 * half(r, r)
  }
  const { heightIn: height, widthIn: width } = g.dimensions
  if (g.shape === 'rectangular') return width
  if (g.shape === 'd_flat_side')
    return width - height / 2 + half(height / 2, height / 2)
  const r = width / 2
  return y <= height - r ? width : 2 * half(r, height - r)
}

// 20,000 steps: the circle's edges are steep, and fewer fall short of 1e-6
const simpson = (f: (y: number) => number, to: number, steps = 20000) => {
  if (to <= 0) return 0
  const step = to / steps
  let sum = f(0) + f(to)
  for (let i = 1; i < steps; i++) sum += f(i * step) * (i % 2 ? 4 : 2)
  return (sum * step) / 3
}

const integrated = (g: TankGeometry, inches: number) => {
  const h = Math.min(Math.max(inches, 0), maxFuelHeight(g))
  const across =
    g.shape === 'cylinder' ? g.dimensions.diameterIn : g.dimensions.heightIn
  if (g.orientation === 'vertical')
    return (simpson(y => widthAt(g, y), across) * h) / 231
  return (simpson(y => widthAt(g, y), h) * g.dimensions.lengthIn) / 231
}

// 25 random tanks of each kind in the form's ranges, from a fixed seed
let seed = 20261002
const random = (from: number, to: number) => {
  seed = (seed * 16807) % 2147483647
  return from + ((seed - 1) / 2147483646) * (to - from)
}
const randomTanks = (orientation: 'horizontal' | 'vertical') =>
  Array.from({ length: 25 }, () => {
    const length = random(20, 120)
    const height = random(14, 34)
    const width = random(14, 34)
    return [
      cylinder(orientation, random(14, 34), length),
      box('rectangular', orientation, height, width, length),
      box(
        'd_flat_side',
        orientation,
        height,
        random(height / 2, height * 1.3),
        length
      ),
      box(
        'd_flat_bottom',
        orientation,
        random(width / 2, width * 1.4),
        width,
        length
      ),
    ]
  }).flat()

describe.each(['horizontal', 'vertical'] as const)('%s tanks', orientation => {
  const tanks = randomTanks(orientation)

  test('each shape agrees with the integration of its cross-section', () => {
    for (const tank of tanks) {
      const max = maxFuelHeight(tank)
      for (let k = 0; k <= 10; k++) {
        const inches = (max * k) / 10
        const reference = integrated(tank, inches)
        expect(
          Math.abs(gallonsAt(tank, inches) - reference),
          `${tank.shape} ${JSON.stringify(tank.dimensions)} at ${String(inches)}`
        ).toBeLessThanOrEqual(Math.max(reference, 1) * 1e-6)
      }
    }
  })

  test('the volume rises from 0 to full, with no jumps nor NaN', () => {
    for (const tank of tanks) {
      const max = maxFuelHeight(tank)
      let before = 0
      for (let k = 0; k <= 200; k++) {
        const gallons = gallonsAt(tank, (max * k) / 200)
        expect(Number.isFinite(gallons)).toBe(true)
        expect(gallons).toBeGreaterThanOrEqual(before - 1e-9)
        before = gallons
      }
      expect(gallonsAt(tank, 0)).toBe(0)
      expect(gallonsAt(tank, max)).toBe(fullVolumeGallons(tank))
    }
  })
})

// specs/0018 RF-10, CA-6: float noise at the ends never gives NaN
test('the cylinder clamps heights a hair outside the tank', () => {
  const full = calcFuelLevel({
    tankDiameter: 26,
    tankLength: 60,
    fuelHeight: 26,
  })
  expect(
    calcFuelLevel({ tankDiameter: 26, tankLength: 60, fuelHeight: 26.000001 })
  ).toBe(full)
  expect(
    calcFuelLevel({ tankDiameter: 26, tankLength: 60, fuelHeight: -1 })
  ).toBe(0)
  // specs/0018 CA-5: π · 13² · 60 / 231, with no rounding on the way
  expect(full).toBeCloseTo((Math.PI * 13 ** 2 * 60) / 231, 10)
  expect(full).toBeCloseTo(137.9037, 4)
})

// specs/0018 RF-3, RF-4
describe('adjusting to the capacity', () => {
  test('measures that agree: full holds the capacity', () => {
    expect(capacityScale(100, 110.3) * 110.3).toBeCloseTo(100, 10)
    expect(capacityMismatch(100, 110.3)).toBe(false)
  })

  test('measures that disagree are kept, and said so', () => {
    expect(capacityScale(70, 110.3)).toBe(1)
    expect(capacityMismatch(70, 110.3)).toBe(true)
  })

  test('a factory tank is always adjusted and never disagrees', () => {
    expect(capacityScale(70, 110.3, { factory: true })).toBeCloseTo(
      70 / 110.3,
      10
    )
    expect(capacityMismatch(70, 110.3, { factory: true })).toBe(false)
  })

  test('without a capacity or a volume, nothing changes', () => {
    expect(capacityScale(null, 110.3)).toBe(1)
    expect(capacityScale(100, 0)).toBe(1)
    expect(capacityMismatch(undefined, 110.3)).toBe(false)
  })

  test('the limit is ±15% of the volume by measures', () => {
    expect(capacityMismatch(85, 100)).toBe(false)
    expect(capacityMismatch(115, 100)).toBe(false)
    expect(capacityMismatch(84.9, 100)).toBe(true)
    expect(capacityMismatch(115.1, 100)).toBe(true)
  })
})
