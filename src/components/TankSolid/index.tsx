import { useTheme } from '@mui/material/styles'
import type { Projection } from 'utils/tankProjection'

type Point = readonly [number, number]

/** a → b by t (0–1), for hex colors: solid shades without seams. */
const mix = (a: string, b: string, t: number) => {
  const parse = (hex: string) =>
    /^#[0-9a-f]{6}$/i.test(hex)
      ? [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16))
      : null
  const from = parse(a)
  const to = parse(b)
  if (!from || !to) return b
  return `rgb(${from.map((value, index) => Math.round(value + ((to[index] ?? value) - value) * t)).join(',')})`
}

export const toPath = (points: readonly Point[]) =>
  `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`

interface TankSolidProps {
  drawing: Projection
  /** From the projection's units to the SVG's. */
  at: (point: Point) => Point
  /** Faint and dashed: the measures are not all typed yet (specs/0013 RF-7). */
  faint?: boolean
  /** Thinner lines, for thumbnails. */
  thin?: boolean
}

/**
 * The tank's faces, shaded by the light, its end and its outline (backend
 * specs/0013 RF-6, specs/0014 RF-2). An SVG group: the parent draws the rest.
 */
export default function TankSolid({
  drawing,
  at,
  faint = false,
  thin = false,
}: TankSolidProps) {
  const theme = useTheme()
  const ink = theme.palette.text.primary
  const paper = theme.palette.background.paper
  return (
    <g opacity={faint ? 0.45 : 1}>
      {drawing.faces.map((face, index) => {
        // Solid: the side of a cylinder is many faces, and see-through
        // shades showed their seams
        const shade = mix(
          paper,
          ink,
          (face.cap ? 0.1 : 0.05) + 0.3 * (1 - face.light)
        )
        return (
          <path
            key={index}
            d={toPath(face.points.map(at))}
            fill={shade}
            stroke={shade}
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
        )
      })}
      {drawing.faces
        .filter(face => face.cap)
        .map((face, index) => (
          <path
            key={`cap-${String(index)}`}
            d={toPath(face.points.map(at))}
            fill="none"
            stroke={ink}
            strokeOpacity={0.55}
            strokeWidth={thin ? 0.8 : 1}
          />
        ))}
      <path
        d={toPath(drawing.outline.map(at))}
        fill="none"
        stroke={ink}
        strokeWidth={thin ? 1.2 : 1.6}
        strokeLinejoin="round"
        strokeDasharray={faint ? '5 4' : undefined}
      />
    </g>
  )
}
