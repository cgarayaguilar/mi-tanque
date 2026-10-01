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
import { readAllMeasurements } from 'services/measurements'
import { readTanks } from 'services/tanks'
import { planImport, type ImportMeasurement } from 'utils/importPlan'

// Firestore allows 500 writes per batch; 450 leaves room (RF-17)
const BATCH_SIZE = 450
// Bounded reads (§2.3): far above what one phone stores
const MAX_EXISTING = 10_000

export interface ImportResult {
  /** Written now; already imported ones are not counted again. */
  imported: number
  /** Local measurements the organization would reject. */
  skipped: number
}

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size))
  }
  return chunks
}

const groupByTank = (measurements: readonly ImportMeasurement[]) => {
  const groups = new Map<string, ImportMeasurement[]>()
  for (const measurement of measurements) {
    const group = groups.get(measurement.tankId) ?? []
    group.push(measurement)
    groups.set(measurement.tankId, group)
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
  const [{ db }, localTanks, localMeasurements] = await Promise.all([
    loadFirebase(),
    readTanks(),
    readAllMeasurements(),
  ])
  const plan = planImport(uid, localTanks, localMeasurements)

  const [existingTanks, existingMeasurements] = await Promise.all([
    getDocs(
      query(
        collection(db, 'tanks'),
        where('orgId', '==', orgId),
        where('createdBy', '==', uid),
        limit(MAX_EXISTING)
      )
    ),
    getDocs(
      query(
        collection(db, 'measurements'),
        where('orgId', '==', orgId),
        where('userId', '==', uid),
        where('source', '==', 'import'),
        limit(MAX_EXISTING)
      )
    ),
  ])
  const tankIds = new Set(existingTanks.docs.map(document => document.id))
  const measurementIds = new Set(
    existingMeasurements.docs.map(document => document.id)
  )

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

  return { imported: newMeasurements.length, skipped: plan.skipped }
}
