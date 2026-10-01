// Importing the basic mode into an organization (backend specs/0004 RF-15–RF-17).
// SDK imported statically: only reached through import() (hooks/useImportLocalData).
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { loadFirebase } from 'services/firebase'
import { readAllLocalRefuels } from 'services/localRefuels'
import { readAllMeasurements } from 'services/measurements'
import { readTanks } from 'services/tanks'
import { planImport } from 'utils/importPlan'

// Firestore allows 500 writes per batch; 450 leaves room (RF-17)
const BATCH_SIZE = 450
// Bounded reads (§2.3): far above what one phone stores
const MAX_EXISTING = 10_000

export interface ImportResult {
  /** Written now; already imported ones are not counted again. */
  measurements: number
  refuels: number
  /** Local records the organization would reject. */
  skipped: number
}

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size))
  }
  return chunks
}

const groupByTank = <T extends { tankId: string }>(records: readonly T[]) => {
  const groups = new Map<string, T[]>()
  for (const record of records) {
    const group = groups.get(record.tankId) ?? []
    group.push(record)
    groups.set(record.tankId, group)
  }
  return [...groups.values()]
}

/**
 * Writes the local tanks used and their measurements. Waits for the server:
 * callers only start it online. Running it again skips what already exists
 * (re-writing an existing document would be an update the rules reject).
 */
export const importLocalData = async ({
  orgId,
  uid,
  userName,
}: {
  orgId: string
  uid: string
  userName: string
}): Promise<ImportResult> => {
  const [{ db }, localTanks, localMeasurements, localRefuels] =
    await Promise.all([
      loadFirebase(),
      readTanks(),
      readAllMeasurements(),
      readAllLocalRefuels(),
    ])
  const plan = planImport(
    uid,
    localTanks,
    localMeasurements,
    new Date(),
    localRefuels
  )

  const imported = (name: 'measurements' | 'refuels') =>
    getDocs(
      query(
        collection(db, name),
        where('orgId', '==', orgId),
        where('userId', '==', uid),
        where('source', '==', 'import'),
        limit(MAX_EXISTING)
      )
    )
  const [existingTanks, existingMeasurements, existingRefuels] =
    await Promise.all([
      getDocs(
        query(
          collection(db, 'tanks'),
          where('orgId', '==', orgId),
          where('createdBy', '==', uid),
          limit(MAX_EXISTING)
        )
      ),
      imported('measurements'),
      imported('refuels'),
    ])
  const tankIds = new Set(existingTanks.docs.map(document => document.id))
  const measurementIds = new Set(
    existingMeasurements.docs.map(document => document.id)
  )
  const refuelIds = new Set(existingRefuels.docs.map(document => document.id))

  // Tanks first: the measurement rules read the tank as it is before the batch
  const newTanks = plan.tanks.filter(tank => !tankIds.has(tank.id))
  for (const tanks of chunk(newTanks, BATCH_SIZE)) {
    const batch = writeBatch(db)
    for (const tank of tanks) {
      batch.set(doc(db, 'tanks', tank.id), {
        orgId,
        name: tank.name,
        description: null,
        photoPath: null,
        archived: false,
        shape: 'cylinder',
        orientation: 'horizontal',
        dimensions: { diameterIn: tank.diameterIn, lengthIn: tank.lengthIn },
        capacityGal: tank.capacityGal,
        equipment: { kind: 'none', id: null },
        templateId: tank.templateId,
        lastMeasurement: null,
        createdAt: serverTimestamp(),
        createdBy: uid,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      })
    }
    await batch.commit()
  }

  // One tank per batch keeps the rules' document reads at two (tank, member)
  const newMeasurements = plan.measurements.filter(
    measurement => !measurementIds.has(measurement.id)
  )
  for (const group of groupByTank(newMeasurements)) {
    for (const measurements of chunk(group, BATCH_SIZE)) {
      const batch = writeBatch(db)
      for (const { id, takenAt, ...measurement } of measurements) {
        batch.set(doc(db, 'measurements', id), {
          ...measurement,
          orgId,
          equipment: { kind: 'none', id: null, name: null },
          userId: uid,
          userName,
          takenAt: Timestamp.fromDate(takenAt),
          location: null,
          place: null,
          placeStatus: null,
          estimate: null,
          odometerKm: null,
          source: 'import',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        })
      }
      await batch.commit()
    }
  }

  const newRefuels = plan.refuels.filter(refuel => !refuelIds.has(refuel.id))
  for (const group of groupByTank(newRefuels)) {
    for (const refuels of chunk(group, BATCH_SIZE)) {
      const batch = writeBatch(db)
      for (const { id, takenAt, ...refuel } of refuels) {
        batch.set(doc(db, 'refuels', id), {
          ...refuel,
          orgId,
          equipment: { kind: 'none', id: null, name: null },
          userId: uid,
          userName,
          takenAt: Timestamp.fromDate(takenAt),
          location: null,
          place: null,
          placeStatus: null,
          truckGallonsBefore: null,
          truckGallonsAfter: null,
          invoicePhotoPath: null,
          odometerKm: null,
          source: 'import',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        })
      }
      await batch.commit()
    }
  }

  return {
    measurements: newMeasurements.length,
    refuels: newRefuels.length,
    skipped: plan.skipped,
  }
}
