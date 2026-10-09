import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import * as z from 'zod/mini'
import {
  TRIP_DOCUMENT_LIMITS,
  TRIP_DOCUMENT_TYPES,
  type TripDocument,
} from 'schemas/tripDocuments'
import { loadFirebase, loadStorage } from 'services/firebase'
import { rememberPhotoUrl } from 'services/fleet'
import { compressImage } from 'utils/compressImage'
import { reportError } from 'utils/reportError'
import { withTimeout } from 'utils/withTimeout'

// A trip's documents (backend specs/0037). Imported statically only by the
// trip's page, which is lazy; the Storage SDK loads on the first upload or
// file shown (RNF-2)

const currentUid = async () => {
  const { auth } = await loadFirebase()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not signed in')
  return uid
}

export const newTripDocumentId = (): string =>
  crypto.randomUUID().replaceAll('-', '')

/** Its file in Storage (RF-2). */
export const tripDocumentPath = (
  orgId: string,
  tripId: string,
  id: string,
  contentType: TripDocument['contentType']
) =>
  `orgs/${orgId}/trips/${tripId}/documents/${id}.${contentType === 'application/pdf' ? 'pdf' : 'jpg'}`

const tripDocumentSchema = z.object({
  orgId: z.string(),
  tripId: z.string(),
  name: z.string(),
  contentType: z.enum(TRIP_DOCUMENT_TYPES),
  size: z.number(),
  path: z.string(),
  createdBy: z.string(),
})

const toTripDocument = (
  id: string,
  data: DocumentData
): TripDocument | null => {
  const parsed = tripDocumentSchema.safeParse(data)
  if (!parsed.success) {
    reportError(parsed.error, { operation: 'parseTripDocument', id })
    return null
  }
  const createdAt: unknown = data.createdAt
  return {
    id,
    ...parsed.data,
    createdAt: createdAt instanceof Timestamp ? createdAt.toDate() : null,
  }
}

/** A trip's documents, oldest first (RF-9). */
export const readTripDocuments = async (
  orgId: string,
  tripId: string
): Promise<TripDocument[]> => {
  const { db } = await loadFirebase()
  const snapshot = await withTimeout(
    getDocs(
      query(
        collection(db, 'tripDocuments'),
        where('orgId', '==', orgId),
        where('tripId', '==', tripId)
      )
    ),
    'readTripDocuments'
  )
  return snapshot.docs
    .map(item => toTripDocument(item.id, item.data()))
    .filter((item): item is TripDocument => item !== null)
    .sort(
      (a, b) =>
        (a.createdAt?.getTime() ?? Infinity) -
        (b.createdAt?.getTime() ?? Infinity)
    )
}

export const PHOTO_TOO_BIG = 'trip-document-photo-too-big'

/**
 * Uploads a file and then its document (RF-2, RF-10): a photo compressed,
 * a PDF as it is. Needs a connection; `onProgress` gets 0 to 1.
 */
export const uploadTripDocument = async (
  input: {
    orgId: string
    tripId: string
    id: string
    name: string
    file: Blob
    kind: 'photo' | 'pdf'
  },
  onProgress: (fraction: number) => void
): Promise<TripDocument> => {
  const contentType =
    input.kind === 'pdf' ? 'application/pdf' : ('image/jpeg' as const)
  const [storage, { ref, uploadBytesResumable, getDownloadURL }, uid, body] =
    await Promise.all([
      loadStorage(),
      import('firebase/storage'),
      currentUid(),
      input.kind === 'pdf' ? input.file : compressImage(input.file),
    ])
  if (
    contentType === 'image/jpeg' &&
    body.size >= TRIP_DOCUMENT_LIMITS.photoBytes
  )
    throw new Error(PHOTO_TOO_BIG)
  const path = tripDocumentPath(
    input.orgId,
    input.tripId,
    input.id,
    contentType
  )
  const fileRef = ref(storage, path)
  const upload = uploadBytesResumable(fileRef, body, { contentType })
  upload.on('state_changed', snapshot => {
    onProgress(
      snapshot.totalBytes > 0
        ? snapshot.bytesTransferred / snapshot.totalBytes
        : 0
    )
  })
  await upload
  rememberPhotoUrl(path, await getDownloadURL(fileRef))
  const { db } = await loadFirebase()
  await setDoc(doc(db, 'tripDocuments', input.id), {
    orgId: input.orgId,
    tripId: input.tripId,
    name: input.name,
    contentType,
    size: body.size,
    path,
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
  return {
    id: input.id,
    orgId: input.orgId,
    tripId: input.tripId,
    name: input.name,
    contentType,
    size: body.size,
    path,
    createdAt: new Date(),
    createdBy: uid,
  }
}

export const renameTripDocument = async (id: string, name: string) => {
  const [{ db }, uid] = await Promise.all([loadFirebase(), currentUid()])
  await updateDoc(doc(db, 'tripDocuments', id), {
    name,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

/** Its file goes too: the backend deletes it (RF-6). */
export const deleteTripDocument = async (id: string) => {
  const { db } = await loadFirebase()
  await deleteDoc(doc(db, 'tripDocuments', id))
}
