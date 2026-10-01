import { db } from 'services/db'
import { newMeasurementSchema } from 'schemas/measurement'
import type { Measurement, NewMeasurement } from 'types'

/** Saves a measurement and returns its id. Rejects on invalid data or storage errors. */
export const createMeasurement = async (
  measurement: NewMeasurement
): Promise<number> =>
  db.measurements.add(newMeasurementSchema.parse(measurement))

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
