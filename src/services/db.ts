import Dexie, { type Table } from 'dexie'
import type { NewLocalRefuel, NewMeasurement } from 'types'

// Tanks created from the form before tankDimensionsSchema existed were stored
// with string dimensions; readers normalize them (services/tanks.ts).
export interface StoredTank {
  id?: number
  capacity: number | string
  diameter: number | string
  length: number | string
}

// Older versions stored numbers where the app now writes strings (and the
// other way round); readers normalize them (services/measurements.ts).
export interface StoredMeasurement extends Omit<
  NewMeasurement,
  'intentId' | 'inches' | 'gallons' | 'liters' | 'fuelHeight' | 'tankId'
> {
  id?: number
  intentId?: string
  inches: number | string
  gallons: number | string
  liters: number | string
  fuelHeight?: number | string
  tankId: number | string
}

export interface StoredRefuel extends NewLocalRefuel {
  id?: number
}

/** An invoice photo waiting for a connection (backend specs/0006 RF-6). */
export interface PendingInvoice {
  refuelId: string
  orgId: string
  uid: string
  photo: Blob
  createdAt: Date
}

class MyTankDatabase extends Dexie {
  declare tanks: Table<StoredTank, number>
  declare measurements: Table<StoredMeasurement, number>
  declare refuels: Table<StoredRefuel, number>
  declare pendingInvoices: Table<PendingInvoice, string>

  constructor() {
    super('MyTank')
    this.version(2).stores({
      tanks: '++id, capacity, diameter, length',
      measurements: '++id,date, inches, gallons, liters, location, tankId',
    })
    // Unique index: a measurement intent can only be stored once (§4.2).
    // Older records have no intentId and are simply left out of the index.
    this.version(3).stores({
      measurements:
        '++id, date, inches, gallons, liters, location, tankId, &intentId',
    })
    // Refuels without an account and the invoice upload queue (specs/0006)
    this.version(4).stores({
      refuels: '++id, date, tankId, &intentId',
      pendingInvoices: 'refuelId, createdAt',
    })
  }
}

export const db = new MyTankDatabase()
