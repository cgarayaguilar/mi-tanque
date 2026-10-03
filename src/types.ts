// Canonical types for data that crosses UI <-> storage (ENGINEERING_PRINCIPLES.md §6.2).
import type { Currency } from 'schemas/account'
// They mirror what IndexedDB stores today and become the Firestore model in phase 3.

export interface TankDimensions {
  /** Nominal capacity, in gallons. */
  capacity: number
  /** Inches. */
  diameter: number
  /** Inches. */
  length: number
}

export interface Tank extends TankDimensions {
  id: number
  /** Chosen from the truck catalog: measured with its capacity (specs/0015). */
  catalogId?: string
}

/** A fuel calculation as shown and stored: amounts are fixed to 2 decimals. */
export interface FuelReading {
  inches: number
  gallons: string
  liters: string
  /** Fill percentage of the tank height. */
  fuelHeight: string
}

export interface NewMeasurement extends FuelReading {
  date: Date
  location: string
  tankId: number
  /** Generated when the measurement form opens; makes saving idempotent (§4.1). */
  intentId: string
}

export interface Measurement extends Omit<NewMeasurement, 'intentId'> {
  id: number
  /** Missing on measurements saved before idempotency keys existed. */
  intentId?: string
}

/** A range of whole days: from the start of `start` to the end of `end`. */
export interface Period {
  start: Date
  end: Date
}

/**
 * The amounts and levels of a refuel (backend specs/0006 RF-2, RF-3), the
 * same with and without an account.
 */
export interface RefuelValues {
  gallonsAdded: number
  litersAdded: number
  quantityUnit: 'gallon' | 'liter'
  currency: Currency
  priceUnit: 'gallon' | 'liter'
  pricePerGallon: number
  pricePerLiter: number
  total: number
  inchesBefore: number | null
  inchesAfter: number | null
  gallonsBefore: number | null
  gallonsAfter: number | null
  fillPercentBefore: number | null
  fillPercentAfter: number | null
  stationName: string | null
}

/** A refuel in the basic mode, on this phone (no place, photo or truck). */
export interface NewLocalRefuel extends RefuelValues {
  intentId: string
  date: Date
  tankId: number
}

export interface LocalRefuel extends NewLocalRefuel {
  id: number
}
