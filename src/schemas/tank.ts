// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import {
  checkTankMeasures,
  tankMeasureFields,
  type TankMeasureLimits,
  type TankMeasureValues,
} from 'schemas/tankMeasures'
import type { TankDimensions } from 'types'
import { parseDecimal } from 'utils/parseDecimal'
import { TANK_ORIENTATIONS } from 'utils/tankVolume'

/**
 * The limits without an account (backend specs/0019 RF-3): the ones the
 * add-tank form always had, for every shape. They fit inside the fleet's, so
 * a tank of this phone is imported whole.
 */
export const TANK_LIMITS = {
  capacity: { min: 10, max: 250 },
  section: { min: 10, max: 99 },
  length: { min: 10, max: 150 },
} satisfies TankMeasureLimits

const BOX_SHAPES = ['rectangular', 'd_flat_side', 'd_flat_bottom'] as const

const storedNumber = (
  { min, max }: { min: number; max: number },
  unit: string
) =>
  z.coerce.number({ error: 'Escribe solo números' }).check(
    z.gte(min, {
      error: `Debe estar entre ${String(min)} y ${String(max)} ${unit}`,
    }),
    z.lte(max, {
      error: `Debe estar entre ${String(min)} y ${String(max)} ${unit}`,
    })
  )

/** A D tank must have room for its half circle (specs/0003, Geometría). */
const roomForTheCurve = (tank: {
  shape: (typeof BOX_SHAPES)[number]
  height: number
  width: number
}) =>
  (tank.shape !== 'd_flat_side' || tank.width >= tank.height / 2) &&
  (tank.shape !== 'd_flat_bottom' || tank.height >= tank.width / 2)

const common = {
  capacity: storedNumber(TANK_LIMITS.capacity, 'galones'),
  orientation: z.enum(TANK_ORIENTATIONS),
  length: storedNumber(TANK_LIMITS.length, 'pulgadas'),
}

// Storage boundary (§6.4) for what is written. Coercion also normalizes the
// strings older forms produced, so tanks are always stored as numbers.
export const tankDimensionsSchema = z.discriminatedUnion('shape', [
  z.object({
    ...common,
    shape: z.literal('cylinder'),
    diameter: storedNumber(TANK_LIMITS.section, 'pulgadas'),
  }),
  z
    .object({
      ...common,
      shape: z.enum(BOX_SHAPES),
      height: storedNumber(TANK_LIMITS.section, 'pulgadas'),
      width: storedNumber(TANK_LIMITS.section, 'pulgadas'),
    })
    .check(
      z.refine(roomForTheCurve, { error: 'Una "D" sin lugar para su curva' })
    ),
])

/** Tanks saved before specs/0019 had no shape: lying cylinders (RF-2). */
export const withShapeDefaults = (raw: unknown): unknown =>
  typeof raw === 'object' && raw !== null
    ? { shape: 'cylinder', orientation: 'horizontal', ...raw }
    : raw

/** Writes a tank: validated, numbers, with its shape. Throws if invalid. */
export const parseTankDimensions = (raw: unknown): TankDimensions =>
  tankDimensionsSchema.parse(withShapeDefaults(raw))

// What is read back is not held to the limits (older builds wrote looser
// values): only numbers, positive, where the shape needs them
const readNumber = z.coerce
  .number()
  .check(z.refine(value => Number.isFinite(value) && value > 0))
const readCommon = {
  capacity: readNumber,
  orientation: z.enum(TANK_ORIENTATIONS),
  length: readNumber,
}
const readSchema = z.discriminatedUnion('shape', [
  z.object({
    ...readCommon,
    shape: z.literal('cylinder'),
    diameter: readNumber,
  }),
  z.object({
    ...readCommon,
    shape: z.enum(BOX_SHAPES),
    height: readNumber,
    width: readNumber,
  }),
])

/** A stored tank's dimensions, old or new; null if they cannot be read. */
export const readTankDimensions = (raw: unknown): TankDimensions | null => {
  const parsed = readSchema.safeParse(withShapeDefaults(raw))
  return parsed.success ? parsed.data : null
}

/** "Agrega tu tanque": the same fields as the fleet's tank (RF-5). */
export const tankFormSchema = z
  .object(tankMeasureFields(TANK_LIMITS))
  .check(checkTankMeasures(TANK_LIMITS))

export type TankFormValues = TankMeasureValues

export const tankFromForm = (values: TankFormValues): TankDimensions => {
  const common = {
    capacity: parseDecimal(values.capacity),
    orientation: values.orientation,
    length: parseDecimal(values.length),
  }
  return values.shape === 'cylinder'
    ? { ...common, shape: 'cylinder', diameter: parseDecimal(values.diameter) }
    : {
        ...common,
        shape: values.shape,
        height: parseDecimal(values.height),
        width: parseDecimal(values.width),
      }
}
