import { db } from 'services/db'
import { newMeasurementSchema } from 'schemas/measurement'
import type { Measurement, NewMeasurement } from 'types'

/**
 * Saves a measurement once per intentId and returns its id. Saving the same
 * intent again (double tap, retry) returns the existing id instead of storing
 * a copy (§4.2). Rejects on invalid data or storage errors.
 */
export const createMeasurement = async (
  measurement: NewMeasurement
): Promise<number> => {
  const valid = newMeasurementSchema.parse(measurement)

  return db.transaction('rw', db.measurements, async () => {
    const existing = await db.measurements
      .where('intentId')
      .equals(valid.intentId)
      .first()

    return existing?.id ?? db.measurements.add(valid)
  })
}

export const readMeasurementsByDateRanges = async ({
  startDate,
  endDate,
}: {
  startDate: Date
  endDate: Date
}): Promise<Measurement[]> => {
  const measurements = await db.measurements
    .where('date')
    .between(startDate, endDate)
    .toArray()

  return measurements.filter(
    (measurement): measurement is Measurement => measurement.id !== undefined
  )
}
