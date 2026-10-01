import Dexie, { type Table } from 'dexie'
import type { NewMeasurement } from 'types'

// Tanks created from the form before tankDimensionsSchema existed were stored
// with string dimensions; readers normalize them (services/tanks.ts).
export interface StoredTank {
  id?: number
  capacity: number | string
  diameter: number | string
  length: number | string
}

export interface StoredMeasurement extends NewMeasurement {
  id?: number
}

class MyTankDatabase extends Dexie {
  declare tanks: Table<StoredTank, number>
  declare measurements: Table<StoredMeasurement, number>

  constructor() {
    super('MyTank')
    this.version(2).stores({
      tanks: '++id, capacity, diameter, length',
      measurements: '++id,date, inches, gallons, liters, location, tankId',
    })
  }
}

export const db = new MyTankDatabase()
