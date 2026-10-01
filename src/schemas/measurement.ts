// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'

const fixedAmount = z.string().check(z.regex(/^\d+(\.\d+)?$/))

// Shape of a measurement at the storage boundary (§6.4). Range checks that
// depend on the tank (inches vs. diameter) belong to the form.
export const newMeasurementSchema = z.object({
  inches: z.number().check(z.positive()),
  gallons: fixedAmount,
  liters: fixedAmount,
  fuelHeight: fixedAmount,
  date: z.date(),
  location: z.string().check(z.minLength(1)),
  tankId: z.int().check(z.positive()),
  intentId: z.uuid(),
})
