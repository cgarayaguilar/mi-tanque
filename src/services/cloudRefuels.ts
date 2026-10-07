// Refuels in Firestore (backend specs/0006). SDK imported statically: only
// lazy pages and import() reach this module, never the basic mode.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import { CURRENCIES } from 'schemas/account'
import type { MeasurementEquipment, Place } from 'services/cloudMeasurements'
import { loadFirebase, loadStorage } from 'services/firebase'
import { photoUrl } from 'services/fleet'
import type { RefuelValues } from 'types'
import type { Position } from 'utils/getCurrentPosition'
import { reportError } from 'utils/reportError'
import { withTimeout } from 'utils/withTimeout'

export const REFUELS_PAGE_SIZE = 100

export interface TruckTotals {
  truckGallonsBefore: number | null
  truckGallonsAfter: number | null
}

export interface CloudRefuel extends RefuelValues, TruckTotals {
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
  invoicePhotoPath: string | null
  odometerKm: number | null
  source: 'app' | 'import'
}

const unit = z.enum(['gallon', 'liter'])
const nullableNumber = z.nullable(z.number())

// Storage boundary (§6.4): written by this app and the trigger, checked anyway
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
  gallonsAdded: z.number(),
  litersAdded: z.number(),
  quantityUnit: unit,
  currency: z.enum(CURRENCIES),
  priceUnit: unit,
  pricePerGallon: z.number(),
  pricePerLiter: z.number(),
  total: z.number(),
  inchesBefore: nullableNumber,
  inchesAfter: nullableNumber,
  gallonsBefore: nullableNumber,
  gallonsAfter: nullableNumber,
  fillPercentBefore: nullableNumber,
  fillPercentAfter: nullableNumber,
  truckGallonsBefore: nullableNumber,
  truckGallonsAfter: nullableNumber,
  stationName: z.nullable(z.string()),
  invoicePhotoPath: z.nullable(z.string()),
  odometerKm: nullableNumber,
  source: z.enum(['app', 'import']),
})

const toDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : null

const toRefuel = (snapshot: QueryDocumentSnapshot): CloudRefuel | null => {
  const data = snapshot.data()
  const parsed = schema.safeParse(data)
  const takenAt = toDate(data.takenAt)
  if (!parsed.success || !takenAt) {
    reportError(parsed.error ?? new Error('Missing takenAt'), {
      operation: 'parseRefuel',
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

export interface NewCloudRefuel {
  id: string
  orgId: string
  tankId: string
  tankName: string
  equipment: MeasurementEquipment
  userId: string
  userName: string
  takenAt: Date
  values: RefuelValues
  totals: TruckTotals
  odometerKm: number | null
}

/** Written with the intent id as its id (ADR 0003); settles on the server. */
export const createCloudRefuel = async (refuel: NewCloudRefuel) => {
  const { db } = await loadFirebase()
  const { values, totals, takenAt, id, ...rest } = refuel
  await setDoc(doc(db, 'refuels', id), {
    ...rest,
    ...values,
    ...totals,
    takenAt: Timestamp.fromDate(takenAt),
    location: null,
    place: null,
    placeStatus: null,
    invoicePhotoPath: null,
    source: 'app',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: rest.userId,
  })
}

/** The GPS answered after the save: one update, by the author (RF-4). */
export const addRefuelLocation = async (
  id: string,
  uid: string,
  { latitude, longitude, accuracy }: Position
) => {
  const { db } = await loadFirebase()
  await updateDoc(doc(db, 'refuels', id), {
    location: {
      lat: latitude,
      lng: longitude,
      accuracyM: Math.round(accuracy),
    },
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

export interface RefuelEdit {
  values: RefuelValues
  totals: TruckTotals
  odometerKm: number | null
}

export const updateCloudRefuel = async (
  id: string,
  uid: string,
  { values, totals, odometerKm }: RefuelEdit
) => {
  const { db } = await loadFirebase()
  await updateDoc(doc(db, 'refuels', id), {
    ...values,
    ...totals,
    odometerKm,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

export const deleteCloudRefuel = async (id: string) => {
  const { db } = await loadFirebase()
  await deleteDoc(doc(db, 'refuels', id))
}

export interface RefuelsPage {
  items: CloudRefuel[]
  cursor: QueryDocumentSnapshot | null
}

/** One page of the period, newest first, optionally of one equipment (RF-7). */
export const readRefuelsPage = async (options: {
  orgId: string
  start: Date
  end: Date
  equipmentId: string | null
  after: QueryDocumentSnapshot | null
  /** Pages of the history; exporting reads bigger ones (specs/0007). */
  pageSize?: number
}): Promise<RefuelsPage> => {
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
    limit(options.pageSize ?? REFUELS_PAGE_SIZE),
  ]
  const snapshot = await withTimeout(
    getDocs(query(collection(db, 'refuels'), ...constraints)),
    'readRefuelsPage'
  )
  const last = snapshot.docs.at(-1) ?? null
  return {
    items: snapshot.docs
      .map(toRefuel)
      .filter((item): item is CloudRefuel => item !== null),
    cursor:
      snapshot.size === (options.pageSize ?? REFUELS_PAGE_SIZE) ? last : null,
  }
}

const stationsSchema = z.object({ names: z.array(z.string()) })

/** The organization's recent stations, kept by the trigger (RF-5). */
export const readStations = async (orgId: string): Promise<string[]> => {
  const { db } = await loadFirebase()
  const snapshot = await getDoc(doc(db, 'stations', orgId))
  const parsed = stationsSchema.safeParse(snapshot.data())
  return parsed.success ? parsed.data.names : []
}

export const invoicePath = (orgId: string, refuelId: string) =>
  `orgs/${orgId}/refuels/${refuelId}/invoice.jpg`

/**
 * Uploads an already compressed invoice and points the refuel at it
 * (RF-6). Needs a connection: the queue calls it when there is one.
 *
 * Picks up where a past try stopped, since the invoice can never be
 * replaced (storage.rules: create only): a photo already up is not sent
 * again, a refuel that already points at it is done, and a refuel that no
 * longer exists has nothing left to attach it to. Either way the queue can
 * let the invoice go.
 */
export const uploadInvoice = async ({
  orgId,
  refuelId,
  uid,
  photo,
}: {
  orgId: string
  refuelId: string
  uid: string
  photo: Blob
}): Promise<'uploaded' | 'discarded'> => {
  const path = invoicePath(orgId, refuelId)
  const [storage, { getMetadata, ref, uploadBytes }, { db }] =
    await Promise.all([
      loadStorage(),
      import('firebase/storage'),
      loadFirebase(),
    ])
  const refuel = await getDoc(doc(db, 'refuels', refuelId))
  if (!refuel.exists()) return 'discarded'
  if (refuel.get('invoicePhotoPath') === path) return 'uploaded'

  const file = ref(storage, path)
  const alreadyUp = await getMetadata(file).then(
    () => true,
    (error: unknown) => {
      if ((error as { code?: unknown }).code === 'storage/object-not-found')
        return false
      throw error
    }
  )
  if (!alreadyUp) {
    await uploadBytes(file, photo, { contentType: 'image/jpeg' })
  }
  await updateDoc(doc(db, 'refuels', refuelId), {
    invoicePhotoPath: path,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
  return 'uploaded'
}

/** The invoice's download URL, remembered for the session. */
export const invoiceUrl = (path: string) => photoUrl(path)
