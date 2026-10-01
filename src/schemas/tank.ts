// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'

const dimension = (label: string, min: number, max: number) => {
  const outOfRange = `Ingresa ${label} entre ${String(min)} y ${String(max)}`

  return z.coerce
    .number({ error: `Ingresa ${label} en números` })
    .check(z.gte(min, { error: outOfRange }), z.lte(max, { error: outOfRange }))
}

// Same limits the add-tank form has always enforced. Coercion also normalizes
// the strings that form inputs produce, so tanks are always stored as numbers.
export const tankDimensionsSchema = z.object({
  capacity: dimension('una capacidad', 10, 250),
  diameter: dimension('un diámetro', 10, 99),
  length: dimension('una longitud', 10, 150),
})
