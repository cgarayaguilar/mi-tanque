// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import { formatNumber } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'
import {
  fullVolumeGallons,
  TANK_ORIENTATIONS,
  TANK_SHAPES,
  type TankGeometry,
} from 'utils/tankVolume'

// A tank's shape and measures as typed, the same in the fleet's form and in
// "Agrega tu tanque" without an account (backend specs/0019 RF-5). Each mode
// passes its own limits.

export interface TankMeasureLimits {
  capacity: { min: number; max: number }
  /** Diameter, height and width of the cross-section. */
  section: { min: number; max: number }
  /** Length, or height when standing. */
  length: { min: number; max: number }
}

export interface TankMeasureValues {
  shape: (typeof TANK_SHAPES)[number]
  orientation: (typeof TANK_ORIENTATIONS)[number]
  capacity: string
  diameter: string
  height: string
  width: string
  length: string
}

export const TANK_SHAPE_LABELS: Record<TankMeasureValues['shape'], string> = {
  cylinder: 'Cilíndrico (redondo)',
  rectangular: 'Cuadrado o rectangular',
  d_flat_side: 'En "D", lado plano contra el chasis',
  d_flat_bottom: 'En "D", fondo plano',
}

export const TANK_ORIENTATION_LABELS: Record<
  TankMeasureValues['orientation'],
  string
> = {
  horizontal: 'Horizontal (acostado)',
  vertical: 'Vertical (de pie)',
}

export const EMPTY_TANK_MEASURES: TankMeasureValues = {
  shape: 'cylinder',
  orientation: 'horizontal',
  capacity: '',
  diameter: '',
  height: '',
  width: '',
  length: '',
}

const inRange = (value: string, min: number, max: number) => {
  const number = parseDecimal(value)
  return !Number.isNaN(number) && number >= min && number <= max
}

/** The fields of the shape and measures, for a form's z.object. */
export const tankMeasureFields = (limits: TankMeasureLimits) => ({
  shape: z.enum(TANK_SHAPES),
  orientation: z.enum(TANK_ORIENTATIONS),
  diameter: z.string(),
  height: z.string(),
  width: z.string(),
  length: z.string(),
  capacity: z.string().check(
    z.trim(),
    z.refine(
      value => inRange(value, limits.capacity.min, limits.capacity.max),
      {
        error: `Escribe la capacidad entre ${String(limits.capacity.min)} y ${String(limits.capacity.max)} galones`,
      }
    )
  ),
})

export const tankGeometryFromForm = (
  values: Pick<
    TankMeasureValues,
    'shape' | 'orientation' | 'diameter' | 'height' | 'width' | 'length'
  >
): TankGeometry =>
  values.shape === 'cylinder'
    ? {
        shape: values.shape,
        orientation: values.orientation,
        dimensions: {
          diameterIn: parseDecimal(values.diameter),
          lengthIn: parseDecimal(values.length),
        },
      }
    : {
        shape: values.shape,
        orientation: values.orientation,
        dimensions: {
          heightIn: parseDecimal(values.height),
          widthIn: parseDecimal(values.width),
          lengthIn: parseDecimal(values.length),
        },
      }

const dimensionMessage = (label: string, min: number, max: number) =>
  `Escribe ${label} entre ${String(min)} y ${String(max)} pulgadas`

interface Issues {
  issues: unknown[]
}

/**
 * The rules hold every reading to twice the capacity (backend specs/0004):
 * measures that give more, like centimeters typed as inches, would have
 * every measurement of the tank refused after it said "saved".
 */
const fitsCapacity = (values: TankMeasureValues, ctx: Issues) => {
  const capacity = parseDecimal(values.capacity)
  if (!Number.isFinite(capacity) || capacity <= 0) return
  const volume = fullVolumeGallons(tankGeometryFromForm(values))
  if (!Number.isFinite(volume) || volume <= capacity * 2) return
  ctx.issues.push({
    code: 'custom',
    input: values.capacity,
    path: ['capacity'],
    message: `Las medidas dan ${formatNumber(volume, 0)} gal, más del doble de la capacidad. Revisa que estén en pulgadas`,
  })
}

/** Each shape asks for its own measures (specs/0003, Geometría). */
export const checkTankMeasures = (limits: TankMeasureLimits) =>
  z.superRefine<TankMeasureValues>((values, ctx) => {
    const check = (
      field: 'diameter' | 'height' | 'width' | 'length',
      label: string,
      { min, max }: { min: number; max: number }
    ) => {
      if (inRange(values[field], min, max)) return true
      ctx.issues.push({
        code: 'custom',
        input: values[field],
        path: [field],
        message: dimensionMessage(label, min, max),
      })
      return false
    }
    const lengthOk = check(
      'length',
      values.orientation === 'vertical' ? 'la altura' : 'el largo',
      limits.length
    )

    if (values.shape === 'cylinder') {
      if (check('diameter', 'el diámetro', limits.section) && lengthOk)
        fitsCapacity(values, ctx)
      return
    }
    const heightOk = check('height', 'el alto', limits.section)
    const widthOk = check('width', 'el ancho', limits.section)
    if (!heightOk || !widthOk || !lengthOk) return

    const height = parseDecimal(values.height)
    const width = parseDecimal(values.width)
    if (values.shape === 'd_flat_side' && width < height / 2) {
      ctx.issues.push({
        code: 'custom',
        input: values.width,
        path: ['width'],
        message: 'El ancho debe ser al menos la mitad del alto',
      })
    }
    if (values.shape === 'd_flat_bottom' && height < width / 2) {
      ctx.issues.push({
        code: 'custom',
        input: values.height,
        path: ['height'],
        message: 'El alto debe ser al menos la mitad del ancho',
      })
    }
    fitsCapacity(values, ctx)
  })
