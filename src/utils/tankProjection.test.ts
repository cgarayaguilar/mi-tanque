import { crossSection, projectTank } from 'utils/tankProjection'
import { TANK_SHAPES } from 'utils/tankVolume'

const area = (points: readonly (readonly [number, number])[]) =>
  points.reduce((sum, [x, y], index) => {
    const [nx, ny] = points[(index + 1) % points.length] as [number, number]
    return sum + x * ny - nx * y
  }, 0) / 2

// specs/0013 RF-6: the drawing keeps the tank's proportions
test('a long cylinder lying down is drawn wider than tall', () => {
  const drawing = projectTank('cylinder', 'horizontal', {
    across: 24,
    up: 24,
    length: 48,
  })
  expect(drawing.width).toBeGreaterThan(drawing.height * 1.5)
})

test('the same cylinder standing is drawn taller than wide', () => {
  const drawing = projectTank('cylinder', 'vertical', {
    across: 24,
    up: 24,
    length: 48,
  })
  expect(drawing.height).toBeGreaterThan(drawing.width * 1.2)
})

test('a longer tank is drawn longer, with the same height', () => {
  const short = projectTank('rectangular', 'horizontal', {
    across: 30,
    up: 24,
    length: 40,
  })
  const long = projectTank('rectangular', 'horizontal', {
    across: 30,
    up: 24,
    length: 80,
  })
  expect(long.width).toBeGreaterThan(short.width + 30)
})

test.each(TANK_SHAPES)(
  'the %s cross-section is counter-clockwise and fits its size',
  shape => {
    // A cylinder is as tall as it is wide: its diameter
    const [across, up] = shape === 'cylinder' ? [24, 24] : [30, 24]
    const points = crossSection(shape, across, up)
    expect(area(points)).toBeGreaterThan(0)
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(-1e-9)
      expect(x).toBeLessThanOrEqual(across + 1e-9)
      expect(y).toBeGreaterThanOrEqual(-1e-9)
      expect(y).toBeLessThanOrEqual(up + 1e-9)
    }
  }
)

test('the cylinder section has the area of its circle', () => {
  expect(area(crossSection('cylinder', 24, 24))).toBeCloseTo(Math.PI * 144, -1)
})

test.each([
  ['cylinder', 'horizontal', ['length', 'up']],
  ['cylinder', 'vertical', ['length', 'across']],
  ['rectangular', 'horizontal', ['length', 'up', 'across']],
  ['d_flat_side', 'vertical', ['length', 'across', 'up']],
] as const)(
  'a %s tank %s shows its own dimension lines',
  (shape, orientation, expected) => {
    const drawing = projectTank(shape, orientation, {
      across: 30,
      up: 24,
      length: 48,
    })
    expect(drawing.dimensions.map(item => item.which)).toEqual(expected)
    // One end and the visible sides, outlined once
    expect(drawing.faces.filter(face => face.cap)).toHaveLength(1)
    expect(drawing.outline.length).toBeGreaterThan(3)
  }
)

test('labels sit off the tank, away from its middle', () => {
  const drawing = projectTank('cylinder', 'horizontal', {
    across: 24,
    up: 24,
    length: 48,
  })
  for (const { label } of drawing.dimensions) {
    const inside =
      label[0] > drawing.width * 0.2 &&
      label[0] < drawing.width * 0.8 &&
      label[1] > drawing.height * 0.2 &&
      label[1] < drawing.height * 0.8
    expect(inside).toBe(false)
  }
})
