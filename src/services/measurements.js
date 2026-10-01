import { db } from 'services/db'

export const createMeasurement = async measurements => {
  try {
    await db.measurements.add(measurements)
  } catch (err) {
    console.error(err)
  }
}

export const readMeasurements = async () => {
  const allMeasurements = await db.measurements.toArray()

  return allMeasurements
}

export const readMeasurementsByDateRanges = async ({ startDate, endDate }) => {
  const allMeasurements = await db.measurements
    .where('date')
    .between(startDate, endDate)
    .toArray()

  return allMeasurements
}
