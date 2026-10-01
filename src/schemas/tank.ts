// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import { parseDecimal } from 'utils/parseDecimal'

/** Limits the add-tank form has always enforced: the single source for both schemas. */
export const TANK_LIMITS = {
  capacity: { min: 10, max: 250, unit: 'galones', name: 'la capacidad' },
  diameter: { min: 10, max: 99, unit: 'pulgadas', name: 'el diámetro' },
  length: { min: 10, max: 150, unit: 'pulgadas', name: 'la longitud' },
} as const

type Dimension = keyof typeof TANK_LIMITS

const rangeMessage = (dimension: Dimension) => {
  const { min, max, unit } = TANK_LIMITS[dimension]
  return `Debe estar entre ${String(min)} y ${String(max)} ${unit}`
}

const storedDimension = (dimension: Dimension) => {
  const { min, max } = TANK_LIMITS[dimension]
  return z.coerce
    .number({ error: 'Escribe solo números' })
    .check(
      z.gte(min, { error: rangeMessage(dimension) }),
      z.lte(max, { error: rangeMessage(dimension) })
    )
}

// Storage boundary (§6.4). Coercion also normalizes the strings older forms
// produced, so tanks are always stored as numbers.
export const tankDimensionsSchema = z.object({
  capacity: storedDimension('capacity'),
  diameter: storedDimension('diameter'),
  length: storedDimension('length'),
})

const formDimension = (dimension: Dimension) => {
  const { min, max, name } = TANK_LIMITS[dimension]
  return z.string().check(
    z.refine(value => value.trim() !== '', {
      error: `Ingresa ${name}`,
      abort: true,
    }),
    z.refine(value => !Number.isNaN(parseDecimal(value)), {
      error: 'Escribe solo números, por ejemplo 24,5',
      abort: true,
    }),
    z.refine(
      value => parseDecimal(value) >= min && parseDecimal(value) <= max,
      { error: rangeMessage(dimension) }
    )
  )
}

/** The add-tank form: typed values, with inline messages (§8.7). */
export const tankFormSchema = z.object({
  capacity: formDimension('capacity'),
  diameter: formDimension('diameter'),
  length: formDimension('length'),
})

export type TankFormValues = z.infer<typeof tankFormSchema>
