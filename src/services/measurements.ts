import { db, type StoredMeasurement } from 'services/db'
import { newMeasurementSchema } from 'schemas/measurement'
import type { Measurement, NewMeasurement, Period } from 'types'

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

// Older versions stored amounts as numbers; the app shows and computes them
// as 2-decimal strings, so readers normalize them (§6.4)
const toFixedAmount = (value: unknown) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toFixed(2) : null
}

const toMeasurement = (stored: StoredMeasurement): Measurement | null => {
  const gallons = toFixedAmount(stored.gallons)
  const liters = toFixedAmount(stored.liters)
  if (stored.id === undefined || gallons === null || liters === null)
    return null

  return {
    ...stored,
    id: stored.id,
    inches: Number(stored.inches),
    gallons,
    liters,
    // Derived from inches when missing; the history recomputes it then
    fuelHeight: toFixedAmount(stored.fuelHeight) ?? '',
    tankId: Number(stored.tankId),
  }
}

/** Measurements taken within the period, oldest first. */
export const readMeasurementsInPeriod = async ({
  start,
  end,
}: Period): Promise<Measurement[]> => {
  // The date index returns them in chronological order
  const stored = await db.measurements
    .where('date')
    .between(start, end, true, true)
    .toArray()

  return stored
    .map(toMeasurement)
    .filter((measurement): measurement is Measurement => measurement !== null)
}
