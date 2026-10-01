// Canonical types for data that crosses UI <-> storage (ENGINEERING_PRINCIPLES.md §6.2).
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
