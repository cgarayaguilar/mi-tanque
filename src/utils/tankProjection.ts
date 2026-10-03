import type { TankOrientation, TankShape } from 'utils/tankVolume'

// The tank drawn in 3D at scale (backend specs/0013 RF-6): a prism whose
// cross-section is the shape, extruded along its length, seen from slightly
// above and to the side. Orthographic, so proportions stay true. Pure: the
// component only turns the result into SVG.

export interface PreviewSize {
  /** Cross-section: across (diameter or width) and up (diameter or height). */
  across: number
  up: number
  length: number
}

type Point2 = readonly [number, number]
type Point3 = readonly [number, number, number]

export interface ProjectedFace {
  points: Point2[]
  /** 0 (in shadow) to 1 (facing the light), to shade the face. */
  light: number
  /** The end of the tank (true) or its side (false). */
  cap: boolean
}

export interface ProjectedDimension {
  from: Point2
  to: Point2
  /** Where the label goes, already moved off the tank. */
  label: Point2
  which: 'across' | 'up' | 'length'
}

export interface Projection {
  faces: ProjectedFace[]
  /** The tank's outline, to stroke it once. */
  outline: Point2[]
  dimensions: ProjectedDimension[]
  width: number
  height: number
}

/** Segments of a half circle: fewer for small drawings (thumbnails). */
const ARC_STEPS = 32

/** Half circle (or full) as points, counter-clockwise from `start`. */
const arc = (
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number,
  steps: number
): Point2[] =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const angle = start + ((end - start) * index) / steps
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
  })

/**
 * The cross-section, counter-clockwise, in (across, up) with (0, 0) at the
 * bottom of the side nearest the viewer. Same shapes as utils/tankVolume.
 */
export const crossSection = (
  shape: TankShape,
  across: number,
  up: number,
  steps = ARC_STEPS
): Point2[] => {
  switch (shape) {
    case 'cylinder': {
      const radius = across / 2
      return arc(
        radius,
        radius,
        radius,
        -Math.PI / 2,
        1.5 * Math.PI,
        2 * steps
      ).slice(0, -1)
    }
    case 'rectangular':
      return [
        [0, 0],
        [across, 0],
        [across, up],
        [0, up],
      ]
    case 'd_flat_side': {
      // Half circle of radius up/2 in front, flat side at the back (the
      // chassis): as utils/tankVolume
      const radius = up / 2
      const back = Math.max(across, radius)
      return [
        [radius, 0],
        [back, 0],
        [back, up],
        ...arc(radius, radius, radius, Math.PI / 2, 1.5 * Math.PI, steps).slice(
          0,
          -1
        ),
      ]
    }
    case 'd_flat_bottom': {
      // Flat bottom, half circle of radius across/2 on top
      const radius = across / 2
      const straight = Math.max(up - radius, 0)
      return [
        [0, 0],
        [across, 0],
        ...arc(radius, straight, radius, 0, Math.PI, steps),
      ]
    }
  }
}

const YAW = (25 * Math.PI) / 180
const PITCH = (20 * Math.PI) / 180
const LIGHT: Point3 = normalize([-0.4, -0.5, 0.75])

function normalize([x, y, z]: Point3): Point3 {
  const size = Math.hypot(x, y, z) || 1
  return [x / size, y / size, z / size]
}

/** World (x right, y away, z up) to camera: turned, then tilted down. */
const rotate = ([x, y, z]: Point3): Point3 => {
  const x1 = x * Math.cos(YAW) - y * Math.sin(YAW)
  const y1 = x * Math.sin(YAW) + y * Math.cos(YAW)
  const y2 = y1 * Math.cos(PITCH) - z * Math.sin(PITCH)
  const z2 = y1 * Math.sin(PITCH) + z * Math.cos(PITCH)
  return [x1, y2, z2]
}

/** On screen: x to the right, y down. */
const toScreen = (point: Point3): Point2 => {
  const [x, , z] = rotate(point)
  return [x, -z]
}

const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Convex hull of screen points (monotone chain), counter-clockwise. */
const hull = (points: Point2[]): Point2[] => {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Point2, a: Point2, b: Point2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: Point2[]) => {
    const result: Point2[] = []
    for (const point of list) {
      while (
        result.length >= 2 &&
        cross(
          result[result.length - 2] as Point2,
          result[result.length - 1] as Point2,
          point
        ) <= 0
      )
        result.pop()
      result.push(point)
    }
    return result.slice(0, -1)
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

/**
 * Projects the tank. Lying down, its length runs left to right and its
 * cross-section is the end you see; standing, its length goes up.
 */
export const projectTank = (
  shape: TankShape,
  orientation: TankOrientation,
  size: PreviewSize,
  steps = ARC_STEPS
): Projection => {
  const { across, up, length } = size
  const section = crossSection(shape, across, up, steps)
  // Section (a, b) at position t along the length, in the world
  const place =
    orientation === 'horizontal'
      ? (a: number, b: number, t: number): Point3 => [t, a - across / 2, b]
      : (a: number, b: number, t: number): Point3 => [
          a - across / 2,
          b - up / 2,
          t,
        ]
  // Directions map the same way (no translation)
  const direction =
    orientation === 'horizontal'
      ? (a: number, b: number, t: number): Point3 => [t, a, b]
      : (a: number, b: number, t: number): Point3 => [a, b, t]

  const faces: ProjectedFace[] = []
  const shade = (normal: Point3) =>
    Math.max(
      0,
      Math.min(1, 0.25 + 0.75 * Math.max(0, dot(normalize(normal), LIGHT)))
    )
  // Seen when it faces the camera, which looks along +y after rotating
  const seen = (normal: Point3) => rotate(normal)[1] < -1e-9

  section.forEach((point, index) => {
    const next = section[(index + 1) % section.length] as Point2
    const normal = direction(next[1] - point[1], -(next[0] - point[0]), 0)
    if (!seen(normal)) return
    faces.push({
      points: [
        toScreen(place(point[0], point[1], 0)),
        toScreen(place(next[0], next[1], 0)),
        toScreen(place(next[0], next[1], length)),
        toScreen(place(point[0], point[1], length)),
      ],
      light: shade(normal),
      cap: false,
    })
  })
  for (const [t, sign] of [
    [0, -1],
    [length, 1],
  ] as const) {
    const normal = direction(0, 0, sign)
    if (!seen(normal)) continue
    faces.push({
      points: section.map(([a, b]) => toScreen(place(a, b, t))),
      light: shade(normal),
      cap: true,
    })
  }

  const all = faces.flatMap(face => face.points)
  const outline = hull(all)
  const xs = all.map(([x]) => x)
  const ys = all.map(([, y]) => y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const shift = ([x, y]: Point2): Point2 => [x - minX, y - minY]
  const width = Math.max(...xs) - minX
  const height = Math.max(...ys) - minY
  const center: Point2 = [width / 2, height / 2]
  const outlineShifted = outline.map(shift)

  // Dimension lines on the bounding box of the cross-section, off the tank
  const gap = Math.max(width, height) * 0.06
  const dimension = (
    which: ProjectedDimension['which'],
    a: Point3,
    b: Point3
  ): ProjectedDimension => {
    const from = shift(toScreen(a))
    const to = shift(toScreen(b))
    const middle: Point2 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
    let normal: Point2 = [-(to[1] - from[1]), to[0] - from[0]]
    const size = Math.hypot(normal[0], normal[1]) || 1
    normal = [normal[0] / size, normal[1] / size]
    if (
      normal[0] * (middle[0] - center[0]) +
        normal[1] * (middle[1] - center[1]) <
      0
    )
      normal = [-normal[0], -normal[1]]
    const away = (point: Point2, distance: number): Point2 => [
      point[0] + normal[0] * distance,
      point[1] + normal[1] * distance,
    ]
    // Past the tank's outline, wherever the measured edge is drawn
    const reach = Math.max(
      0,
      ...outlineShifted.map(
        point =>
          (point[0] - from[0]) * normal[0] + (point[1] - from[1]) * normal[1]
      )
    )
    return {
      from: away(from, reach + gap),
      to: away(to, reach + gap),
      label: away(middle, reach + gap * 2.6),
      which,
    }
  }

  const dimensions: ProjectedDimension[] =
    orientation === 'horizontal'
      ? [
          dimension('length', place(0, 0, 0), place(0, 0, length)),
          // With a width too, the height goes to the far end: apart
          shape === 'cylinder'
            ? dimension('up', place(0, 0, 0), place(0, up, 0))
            : dimension(
                'up',
                place(across, 0, length),
                place(across, up, length)
              ),
          ...(shape === 'cylinder'
            ? []
            : [dimension('across', place(0, 0, 0), place(across, 0, 0))]),
        ]
      : [
          dimension('length', place(0, 0, 0), place(0, 0, length)),
          dimension('across', place(0, 0, 0), place(across, 0, 0)),
          // The depth on the lid, away from the other two
          ...(shape === 'cylinder'
            ? []
            : [
                dimension(
                  'up',
                  place(across, 0, length),
                  place(across, up, length)
                ),
              ]),
        ]

  return {
    faces: faces.map(face => ({ ...face, points: face.points.map(shift) })),
    outline: outlineShifted,
    dimensions,
    width,
    height,
  }
}
