import { z } from 'zod'

const fixedAmount = z.string().regex(/^\d+(\.\d+)?$/)

// Shape of a measurement at the storage boundary (§6.4). Range checks that
// depend on the tank (inches vs. diameter) belong to the form.
export const newMeasurementSchema = z.object({
  inches: z.number().positive(),
  gallons: fixedAmount,
  liters: fixedAmount,
  fuelHeight: fixedAmount,
  date: z.date(),
  location: z.string().min(1),
  tankId: z.number().int().positive(),
})
