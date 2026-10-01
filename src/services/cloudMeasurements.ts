// Measurements in Firestore (backend specs/0004). SDK imported statically:
// only lazy pages and dynamically imported stores reach this module.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import * as z from 'zod/mini'
import { loadFirebase } from 'services/firebase'
import type { Position } from 'utils/getCurrentPosition'
import type { CloudReading } from 'utils/measurementMath'
import { reportError } from 'utils/reportError'

export const HISTORY_PAGE_SIZE = 100

export interface MeasurementEquipment {
  kind: 'none' | 'truck' | 'trailer'
  id: string | null
  name: string | null
}

export interface Place {
  country: string
  countryCode: string
  state: string | null
  city: string | null
}

export interface CloudMeasurement extends CloudReading {
  id: string
  orgId: string
  tankId: string
  tankName: string
  equipment: MeasurementEquipment
  userId: string
  userName: string
  takenAt: Date
  createdAt: Date | null
  location: { lat: number; lng: number; accuracyM: number } | null
  place: Place | null
  placeStatus: 'done' | 'not_found' | 'error' | null
  legacyPlace: string | null
  odometerKm: number | null
  source: 'app' | 'import'
}

const toDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : null

const schema = z.object({
  orgId: z.string(),
  tankId: z.string(),
  tankName: z.string(),
  equipment: z.object({
    kind: z.enum(['none', 'truck', 'trailer']),
    id: z.nullable(z.string()),
    name: z.nullable(z.string()),
  }),
  userId: z.string(),
  userName: z.string(),
  location: z.nullable(
    z.object({ lat: z.number(), lng: z.number(), accuracyM: z.number() })
  ),
  place: z.nullable(
    z.object({
      country: z.string(),
      countryCode: z.string(),
      state: z.nullable(z.string()),
      city: z.nullable(z.string()),
    })
  ),
  placeStatus: z.nullable(z.enum(['done', 'not_found', 'error'])),
  legacyPlace: z.nullable(z.string()),
  inches: z.number(),
  gallons: z.number(),
  liters: z.number(),
  fillPercent: z.number(),
  estimate: z.nullable(
    z.object({ km: z.number(), miles: z.number(), kmPerGal: z.number() })
  ),
  odometerKm: z.nullable(z.number()),
  source: z.enum(['app', 'import']),
})

const toMeasurement = (
  snapshot: QueryDocumentSnapshot
): CloudMeasurement | null => {
  const data = snapshot.data()
  const parsed = schema.safeParse(data)
  const takenAt = toDate(data.takenAt)
  if (!parsed.success || !takenAt) {
    reportError(parsed.error ?? new Error('Missing takenAt'), {
      operation: 'parseMeasurement',
      id: snapshot.id,
    })
    return null
  }
  return {
    id: snapshot.id,
    ...parsed.data,
    takenAt,
    // Pending server timestamp on a local write: treat as just now
    createdAt: toDate(data.createdAt) ?? new Date(),
  }
}

export interface NewCloudMeasurement {
  id: string
  orgId: string
  tankId: string
  tankName: string
  equipment: MeasurementEquipment
  userId: string
  userName: string
  takenAt: Date
  reading: CloudReading
  odometerKm: number | null
}

/**
 * Writes the measurement with the intent id as its document id (ADR 0003).
 * Settles when the server accepts it; offline it waits in the queue.
 */
export const createCloudMeasurement = async (
  measurement: NewCloudMeasurement
) => {
  const { db } = await loadFirebase()
  const { reading, takenAt, id, ...rest } = measurement
  await setDoc(doc(db, 'measurements', id), {
    ...rest,
    ...reading,
    takenAt: Timestamp.fromDate(takenAt),
    location: null,
    place: null,
    placeStatus: null,
    legacyPlace: null,
    source: 'app',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: rest.userId,
  })
}

/** The GPS answered after the save: one update, once (RF-4). */
export const addMeasurementLocation = async (
  id: string,
  uid: string,
  { latitude, longitude, accuracy }: Position
) => {
  const { db } = await loadFirebase()
  await updateDoc(doc(db, 'measurements', id), {
    location: {
      lat: latitude,
      lng: longitude,
      accuracyM: Math.round(accuracy),
    },
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

export interface MeasurementEdit {
  tankId: string
  tankName: string
  equipment: MeasurementEquipment
  reading: CloudReading
  odometerKm: number | null
}

export const updateCloudMeasurement = async (
  id: string,
  uid: string,
  { reading, ...rest }: MeasurementEdit
) => {
  const { db } = await loadFirebase()
  await updateDoc(doc(db, 'measurements', id), {
    ...rest,
    ...reading,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

export const deleteCloudMeasurement = async (id: string) => {
  const { db } = await loadFirebase()
  await deleteDoc(doc(db, 'measurements', id))
}

export interface HistoryPage {
  items: CloudMeasurement[]
  /** Pass it back to load the next page; null when there is no more. */
  cursor: QueryDocumentSnapshot | null
}

/** One page of the organization's history, newest first (RF-10, RF-11). */
export const readHistoryPage = async (options: {
  orgId: string
  start: Date
  end: Date
  equipmentId: string | null
  after: QueryDocumentSnapshot | null
  /** Pages of the history; exporting reads bigger ones (specs/0007). */
  pageSize?: number
}): Promise<HistoryPage> => {
  const { db } = await loadFirebase()
  const constraints: QueryConstraint[] = [
    where('orgId', '==', options.orgId),
    ...(options.equipmentId
      ? [where('equipment.id', '==', options.equipmentId)]
      : []),
    where('takenAt', '>=', Timestamp.fromDate(options.start)),
    where('takenAt', '<=', Timestamp.fromDate(options.end)),
    orderBy('takenAt', 'desc'),
    ...(options.after ? [startAfter(options.after)] : []),
    limit(options.pageSize ?? HISTORY_PAGE_SIZE),
  ]
  const snapshot = await getDocs(
    query(collection(db, 'measurements'), ...constraints)
  )
  const last = snapshot.docs.at(-1) ?? null
  return {
    items: snapshot.docs
      .map(toMeasurement)
      .filter((item): item is CloudMeasurement => item !== null),
    cursor:
      snapshot.size === (options.pageSize ?? HISTORY_PAGE_SIZE) ? last : null,
  }
}
