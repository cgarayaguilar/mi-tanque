import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { radius } from 'theme/tokens'
import { formatNumber } from 'utils/formatNumber'
import { projectTank, type PreviewSize } from 'utils/tankProjection'
import {
  capacityMatches,
  fullVolumeGallons,
  type TankGeometry,
  type TankOrientation,
  type TankShape,
} from 'utils/tankVolume'

export interface TankPreviewProps {
  shape: TankShape
  orientation: TankOrientation
  /** What was typed, in inches: null when empty or not a positive number. */
  diameter?: number | null
  height?: number | null
  width?: number | null
  length: number | null
  /** Gallons, as stated; null when not typed. */
  capacity?: number | null
  /** The guide names each measure instead of showing its value. */
  labels?: 'values' | 'names'
}

// A typical tank, drawn faintly until the measures are typed (RF-7)
const TYPICAL = { diameter: 24, height: 24, width: 30, length: 48 }

// The drawing area (viewBox units) and the room left for the labels
// Labels go beside vertical lines: more room on the sides than above
const VIEW = { width: 360, height: 210, padX: 66, padY: 40 }
// Standing, the drawing needs more height to keep a readable size
const TALL_HEIGHT = 270
const ARROW = 5
const LABEL_GAP = 8
const LABEL_SIZE = 13
const VIEW_MARGIN = 6

const SHAPE_NAMES: Record<TankShape, string> = {
  cylinder: 'Cilindro',
  rectangular: 'Tanque rectangular',
  d_flat_side: 'Tanque en "D" de lado plano',
  d_flat_bottom: 'Tanque en "D" de fondo plano',
}

const valid = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isFinite(value) && value > 0

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

const toPath = (points: readonly (readonly [number, number])[]) =>
  `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`

/** The names of the measures of a shape, as the form calls them. */
const measureNames = (shape: TankShape, orientation: TankOrientation) => ({
  across: shape === 'cylinder' ? 'Diámetro' : 'Ancho',
  up: shape === 'cylinder' ? 'Diámetro' : 'Alto',
  length: orientation === 'vertical' ? 'Altura' : 'Largo',
})

/**
 * The tank in 3D at scale, with its measures, and how much fits by them
 * compared with the stated capacity (backend specs/0013 RF-6–RF-10). Under
 * the fields; it changes as they are typed.
 */
export default function TankPreview({
  shape,
  orientation,
  diameter,
  height,
  width,
  length,
  capacity,
  labels = 'values',
}: TankPreviewProps) {
  const theme = useTheme()
  const cylinder = shape === 'cylinder'
  const typed = cylinder
    ? { across: diameter, up: diameter, length }
    : { across: width, up: height, length }
  const complete = valid(typed.across) && valid(typed.up) && valid(typed.length)
  const size: PreviewSize = {
    across: valid(typed.across)
      ? typed.across
      : cylinder
        ? TYPICAL.diameter
        : TYPICAL.width,
    up: valid(typed.up)
      ? typed.up
      : cylinder
        ? TYPICAL.diameter
        : TYPICAL.height,
    length: valid(typed.length) ? typed.length : TYPICAL.length,
  }
  // A cylinder is as tall as it is wide, whatever is still missing
  if (cylinder) size.up = size.across

  const drawing = projectTank(shape, orientation, size)
  const viewHeight = orientation === 'vertical' ? TALL_HEIGHT : VIEW.height
  const scale = Math.min(
    (VIEW.width - 2 * VIEW.padX) / (drawing.width || 1),
    (viewHeight - 2 * VIEW.padY) / (drawing.height || 1)
  )
  const offsetX = (VIEW.width - drawing.width * scale) / 2
  const offsetY = (viewHeight - drawing.height * scale) / 2
  const at = ([x, y]: readonly [number, number]): [number, number] => [
    offsetX + x * scale,
    offsetY + y * scale,
  ]

  const names = measureNames(shape, orientation)
  const labelOf = (which: 'across' | 'up' | 'length') => {
    if (labels === 'names') return names[which]
    const value = typed[which]
    return valid(value) ? `${formatNumber(value)} pulg.` : '?'
  }

  // Dimension lines, their arrowheads and labels, placed off the tank
  const dims = drawing.dimensions.map(item => {
    const from = at(item.from)
    const to = at(item.to)
    const middle: [number, number] = [
      (from[0] + to[0]) / 2,
      (from[1] + to[1]) / 2,
    ]
    const towards = at(item.label)
    const away = Math.hypot(towards[0] - middle[0], towards[1] - middle[1]) || 1
    const nx = (towards[0] - middle[0]) / away
    const ny = (towards[1] - middle[1]) / away
    // Text grows away from the line: right of it, left of it or centered
    const anchor: 'start' | 'end' | 'middle' =
      nx > 0.3 ? 'start' : nx < -0.3 ? 'end' : 'middle'
    const label: [number, number] = [
      middle[0] + nx * LABEL_GAP * 1.5,
      middle[1] + ny * LABEL_GAP * 1.8,
    ]
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1
    const ux = (to[0] - from[0]) / length
    const uy = (to[1] - from[1]) / length
    const head = (tip: [number, number], sign: number) =>
      toPath([
        tip,
        [
          tip[0] - sign * ux * ARROW * 1.6 - uy * ARROW * 0.7,
          tip[1] - sign * uy * ARROW * 1.6 + ux * ARROW * 0.7,
        ],
        [
          tip[0] - sign * ux * ARROW * 1.6 + uy * ARROW * 0.7,
          tip[1] - sign * uy * ARROW * 1.6 - ux * ARROW * 0.7,
        ],
      ])
    const text = labelOf(item.which)
    // Rough text box, to keep every label inside the drawing
    const textWidth = text.length * LABEL_SIZE * 0.58
    const left =
      anchor === 'start'
        ? label[0]
        : anchor === 'end'
          ? label[0] - textWidth
          : label[0] - textWidth / 2
    const box: [number, number, number, number] = [
      left,
      label[1] - LABEL_SIZE,
      left + textWidth,
      label[1] + LABEL_SIZE,
    ]
    return {
      which: item.which,
      from,
      to,
      label,
      anchor,
      text,
      heads: [head(from, -1), head(to, 1)],
      box,
    }
  })
  // The view fits the tank, its lines and its labels, whatever their sizes
  const xs = [
    ...drawing.outline.map(point => at(point)[0]),
    ...dims.flatMap(item => [
      item.from[0],
      item.to[0],
      item.box[0],
      item.box[2],
    ]),
  ]
  const ys = [
    ...drawing.outline.map(point => at(point)[1]),
    ...dims.flatMap(item => [
      item.from[1],
      item.to[1],
      item.box[1],
      item.box[3],
    ]),
  ]
  const viewBox = [
    Math.min(...xs) - VIEW_MARGIN,
    Math.min(...ys) - VIEW_MARGIN,
    Math.max(...xs) - Math.min(...xs) + 2 * VIEW_MARGIN,
    Math.max(...ys) - Math.min(...ys) + 2 * VIEW_MARGIN,
  ]
    .map(value => value.toFixed(1))
    .join(' ')

  const geometry: TankGeometry | null = complete
    ? cylinder
      ? {
          shape,
          orientation,
          dimensions: { diameterIn: size.across, lengthIn: size.length },
        }
      : {
          shape,
          orientation,
          dimensions: {
            heightIn: size.up,
            widthIn: size.across,
            lengthIn: size.length,
          },
        }
    : null
  const volume = geometry ? fullVolumeGallons(geometry) : null
  const stated = valid(capacity) ? capacity : null

  const description = complete
    ? `${SHAPE_NAMES[shape]} ${orientation === 'vertical' ? 'de pie' : 'acostado'}: ${
        cylinder
          ? `${formatNumber(size.across)} pulgadas de diámetro`
          : `${formatNumber(size.up)} de alto y ${formatNumber(size.across)} de ancho`
      }, ${formatNumber(size.length)} de ${names.length.toLowerCase()}${
        volume === null
          ? ''
          : `; caben unos ${formatNumber(Math.round(volume))} galones`
      }`
    : `${SHAPE_NAMES[shape]} ${orientation === 'vertical' ? 'de pie' : 'acostado'}, sin todas sus medidas`

  const ink = theme.palette.text.primary
  const paper = theme.palette.background.paper
  const muted = theme.palette.text.secondary

  return (
    <Box
      sx={{
        p: 3,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.lg)}px`,
      }}
    >
      <Box
        component="svg"
        role="img"
        aria-label={
          labels === 'names'
            ? `${SHAPE_NAMES[shape]} con sus medidas`
            : description
        }
        viewBox={viewBox}
        // A phone's width at most: wider, the labels grew too big
        sx={{
          display: 'block',
          width: '100%',
          maxWidth: 380,
          maxHeight: 300,
          mx: 'auto',
        }}
      >
        <g opacity={complete || labels === 'names' ? 1 : 0.45}>
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
                strokeWidth={1}
              />
            ))}
          <path
            d={toPath(drawing.outline.map(at))}
            fill="none"
            stroke={ink}
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeDasharray={complete || labels === 'names' ? undefined : '5 4'}
          />
        </g>

        {dims.map(item => (
          <g key={item.which}>
            <line
              x1={item.from[0]}
              y1={item.from[1]}
              x2={item.to[0]}
              y2={item.to[1]}
              stroke={muted}
              strokeWidth={1}
            />
            {item.heads.map(head => (
              <path key={head} d={head} fill={muted} />
            ))}
            <text
              x={item.label[0]}
              y={item.label[1]}
              textAnchor={item.anchor}
              dominantBaseline="middle"
              fill={muted}
              fontFamily={theme.typography.fontFamily}
              fontSize={LABEL_SIZE}
              fontWeight={500}
            >
              {item.text}
            </text>
          </g>
        ))}
      </Box>

      {labels === 'values' && (
        <Box role="status" sx={{ mt: 2 }}>
          {volume === null ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Escribe las medidas para ver tu tanque y cuánto le cabe.
            </Typography>
          ) : (
            <>
              <Typography variant="body2">
                Caben unos {formatNumber(Math.round(volume))} gal según las
                medidas.
              </Typography>
              {stated !== null &&
                (capacityMatches(volume, stated) ? (
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: 'success.main',
                    }}
                  >
                    <CheckCircleIcon fontSize="small" aria-hidden="true" />
                    Coincide con la capacidad ({formatNumber(stated)} gal).
                  </Typography>
                ) : (
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 1,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      color: 'error.main',
                    }}
                  >
                    <ErrorOutlineIcon fontSize="small" aria-hidden="true" />
                    La capacidad dice {formatNumber(stated)} gal. Revisa las
                    medidas o la capacidad.
                  </Typography>
                ))}
            </>
          )}
        </Box>
      )}
    </Box>
  )
}
