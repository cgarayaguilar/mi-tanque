// The fleet in Firestore (backend specs/0003). Imports the SDK statically:
// only lazy fleet pages import it directly; the fleet store uses import().
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import * as z from 'zod/mini'
import type { FleetTank, Trailer, Truck } from 'schemas/fleet'
import { loadFirebase, loadStorage } from 'services/firebase'
import { compressImage } from 'utils/compressImage'
import { reportError } from 'utils/reportError'
import { ROLES } from 'utils/roles'

export type FleetCollection = 'trucks' | 'trailers' | 'tanks'

// One read per collection, bounded (§2.3, specs/0003 RNF-1)
export const MAX_FLEET_ITEMS = 500

// Storage boundary (§6.4): documents written by this app, checked anyway
const nullableString = z.nullable(z.string())
const nullableNumber = z.nullable(z.number())
const color = z.nullable(z.object({ swatch: z.string(), label: z.string() }))
const base = {
  orgId: z.string(),
  name: z.string(),
  description: nullableString,
  photoPath: nullableString,
  archived: z.boolean(),
}
const vehicle = {
  ...base,
  plate: nullableString,
  brand: nullableString,
  model: nullableString,
  year: nullableNumber,
  color,
  vin: nullableString,
}
const truckSchema = z.object({
  ...vehicle,
  distanceUnit: z.enum(['km', 'mi']),
  fuelEfficiencyKmPerGal: nullableNumber,
  odometerKm: nullableNumber,
  assignedDriverUid: nullableString,
})
const trailerSchema = z.object({
  ...vehicle,
  trailerType: z.enum(['dry', 'reefer', 'tanker', 'flatbed', 'other']),
  trailerTypeOther: nullableString,
  lengthFt: nullableNumber,
  reeferConsumptionGalPerHour: nullableNumber,
  hitchedTruckId: nullableString,
})
const tankSchema = z.object({
  ...base,
  shape: z.enum(['cylinder', 'rectangular', 'd_flat_side', 'd_flat_bottom']),
  orientation: z.enum(['horizontal', 'vertical']),
  dimensions: z.object({
    diameterIn: z.optional(z.number()),
    heightIn: z.optional(z.number()),
    widthIn: z.optional(z.number()),
    lengthIn: z.number(),
  }),
  capacityGal: z.number(),
  equipment: z.object({
    kind: z.enum(['none', 'truck', 'trailer']),
    id: nullableString,
  }),
  templateId: nullableString,
})

const readCollection = async <T>(
  name: FleetCollection,
  orgId: string,
  parse: (id: string, data: unknown) => T | null
): Promise<T[]> => {
  const { db } = await loadFirebase()
  const snapshot = await getDocs(
    query(
      collection(db, name),
      where('orgId', '==', orgId),
      limit(MAX_FLEET_ITEMS)
    )
  )
  return snapshot.docs
    .map(document => parse(document.id, document.data()))
    .filter((item): item is T => item !== null)
}

const parseWith =
  <S extends z.ZodMiniType>(schema: S, collectionName: string) =>
  (id: string, data: unknown): (z.infer<S> & { id: string }) | null => {
    const parsed = schema.safeParse(data)
    if (!parsed.success) {
      // Skip a malformed document instead of breaking the whole list
      reportError(parsed.error, {
        operation: 'parseFleetItem',
        collectionName,
        id,
      })
      return null
    }
    return { id, ...(parsed.data as object) } as z.infer<S> & { id: string }
  }

const toTank = (id: string, data: unknown): FleetTank | null => {
  const tank = parseWith(tankSchema, 'tanks')(id, data)
  if (!tank) return null
  const { dimensions, equipment, ...rest } = tank
  const normalizedEquipment =
    equipment.kind === 'none' || equipment.id === null
      ? ({ kind: 'none', id: null } as const)
      : { kind: equipment.kind, id: equipment.id }

  if (rest.shape === 'cylinder') {
    if (dimensions.diameterIn === undefined) return null
    return {
      ...rest,
      shape: 'cylinder',
      equipment: normalizedEquipment,
      dimensions: {
        diameterIn: dimensions.diameterIn,
        lengthIn: dimensions.lengthIn,
      },
    }
  }
  if (dimensions.heightIn === undefined || dimensions.widthIn === undefined) {
    return null
  }
  return {
    ...rest,
    shape: rest.shape,
    equipment: normalizedEquipment,
    dimensions: {
      heightIn: dimensions.heightIn,
      widthIn: dimensions.widthIn,
      lengthIn: dimensions.lengthIn,
    },
  }
}

export interface Fleet {
  trucks: Truck[]
  trailers: Trailer[]
  tanks: FleetTank[]
}

/** The whole fleet of an organization: three bounded reads, cache-first offline. */
export const readFleet = async (orgId: string): Promise<Fleet> => {
  const [trucks, trailers, tanks] = await Promise.all([
    readCollection('trucks', orgId, parseWith(truckSchema, 'trucks')),
    readCollection('trailers', orgId, parseWith(trailerSchema, 'trailers')),
    readCollection('tanks', orgId, toTank),
  ])
  return {
    trucks: trucks as Truck[],
    trailers: trailers as Trailer[],
    tanks,
  }
}

export interface OrgMember {
  uid: string
  displayName: string
  role: (typeof ROLES)[number]
}

const memberSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  role: z.enum(ROLES),
})

/** Members of the organization, for the assigned-driver select. */
export const readMembers = async (orgId: string): Promise<OrgMember[]> => {
  const { db } = await loadFirebase()
  const snapshot = await getDocs(
    query(collection(db, 'members'), where('orgId', '==', orgId), limit(200))
  )
  return snapshot.docs
    .map(document => memberSchema.safeParse(document.data()))
    .filter(result => result.success)
    .map(result => result.data)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
}

/**
 * A document id for a new item, made when its form opens: saving again (a
 * retry, a double tap, offline sync) writes the same document (ADR 0003).
 */
export const newFleetId = (): string => crypto.randomUUID().replaceAll('-', '')

const currentUid = async () => {
  const { auth } = await loadFirebase()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not signed in')
  return uid
}

/**
 * Writes a new item. The returned promise settles when the server accepts it;
 * offline the write is already applied locally and waits in the queue, so
 * callers do not hold the UI on it.
 */
export const createFleetItem = async (
  name: FleetCollection,
  id: string,
  orgId: string,
  data: object
): Promise<void> => {
  const [{ db }, uid] = await Promise.all([loadFirebase(), currentUid()])
  await setDoc(doc(db, name, id), {
    ...data,
    orgId,
    photoPath: null,
    archived: false,
    ...(name === 'tanks' && { lastMeasurement: null }),
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

export const updateFleetItem = async (
  name: FleetCollection,
  id: string,
  changes: object
): Promise<void> => {
  const [{ db }, uid] = await Promise.all([loadFirebase(), currentUid()])
  await updateDoc(doc(db, name, id), {
    ...changes,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

export const photoPathFor = (
  name: FleetCollection,
  orgId: string,
  id: string
) => `orgs/${orgId}/${name}/${id}/photo.jpg`

const photoUrls = new Map<string, string>()

/** Download URL of a stored photo, remembered for the session. */
export const photoUrl = async (path: string): Promise<string> => {
  const cached = photoUrls.get(path)
  if (cached) return cached
  const [storage, { getDownloadURL, ref }] = await Promise.all([
    loadStorage(),
    import('firebase/storage'),
  ])
  const url = await getDownloadURL(ref(storage, path))
  photoUrls.set(path, url)
  return url
}

/**
 * Compresses and uploads the item's photo (it replaces the previous one),
 * then points the document at it. Needs a connection (RF-13).
 */
export const uploadFleetPhoto = async (
  name: FleetCollection,
  orgId: string,
  id: string,
  file: Blob
): Promise<{ path: string; url: string }> => {
  const path = photoPathFor(name, orgId, id)
  const [storage, { ref, uploadBytes, getDownloadURL }, compressed] =
    await Promise.all([
      loadStorage(),
      import('firebase/storage'),
      compressImage(file),
    ])
  const photoRef = ref(storage, path)
  await uploadBytes(photoRef, compressed, { contentType: 'image/jpeg' })
  // A new URL: the old one may be cached with the previous photo's token
  const url = await getDownloadURL(photoRef)
  photoUrls.set(path, url)
  await updateFleetItem(name, id, { photoPath: path })
  return { path, url }
}
