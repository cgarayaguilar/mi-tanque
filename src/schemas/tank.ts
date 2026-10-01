import { z } from 'zod'

const dimension = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `Ingresa ${label} en números` })
    .min(min, {
      error: `Ingresa ${label} entre ${String(min)} y ${String(max)}`,
    })
    .max(max, {
      error: `Ingresa ${label} entre ${String(min)} y ${String(max)}`,
    })

// Same limits the add-tank form has always enforced. Coercion also normalizes
// the strings that form inputs produce, so tanks are always stored as numbers.
export const tankDimensionsSchema = z.object({
  capacity: dimension('una capacidad', 10, 250),
  diameter: dimension('un diámetro', 10, 99),
  length: dimension('una longitud', 10, 150),
})
