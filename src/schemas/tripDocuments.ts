// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { requiredText } from 'schemas/fleet'
import type { Role } from 'utils/roles'
import { canWriteFleet } from 'utils/roles'

// A trip's documents (backend specs/0037): what they are, and what the app
// checks before uploading one. The rules check the same ceilings (RF-4, RF-5)

export const TRIP_DOCUMENT_TYPES = ['image/jpeg', 'application/pdf'] as const
export type TripDocumentType = (typeof TRIP_DOCUMENT_TYPES)[number]

const MB = 1024 * 1024

export const TRIP_DOCUMENT_LIMITS = {
  name: 80,
  /** Per trip (RF-3): the app counts, the rules cannot. */
  perTrip: 30,
  /** A photo, once compressed on the phone (RF-2). */
  photoBytes: 2 * MB,
  pdfBytes: 10 * MB,
}

export interface TripDocument {
  id: string
  orgId: string
  tripId: string
  name: string
  contentType: TripDocumentType
  size: number
  path: string
  /** null while the server has not stamped it. */
  createdAt: Date | null
  createdBy: string
}

/** What a file chosen on the phone is: a photo, a PDF, or neither. */
export const fileKindOf = (file: { name: string; type: string }) => {
  if (file.type.startsWith('image/')) return 'photo' as const
  // Some file pickers give a PDF without its type
  if (
    file.type === 'application/pdf' ||
    (file.type === '' && /\.pdf$/i.test(file.name))
  )
    return 'pdf' as const
  return null
}

/** Why a file cannot be uploaded to a trip with `count` documents (RF-11). */
export const fileIssue = (
  file: { name: string; type: string; size: number },
  count: number
): string | null => {
  if (count >= TRIP_DOCUMENT_LIMITS.perTrip)
    return `Este viaje ya tiene ${String(TRIP_DOCUMENT_LIMITS.perTrip)} documentos.`
  const kind = fileKindOf(file)
  if (!kind) return 'Solo se aceptan fotos y PDF.'
  if (kind === 'pdf' && file.size >= TRIP_DOCUMENT_LIMITS.pdfBytes)
    return 'El PDF pesa más de 10 MB.'
  return null
}

/**
 * Its first name (RF-10): the file's, without its extension, or "Foto del
 * 9 oct, 14:32" for a photo just taken.
 */
export const defaultDocumentName = (
  file: { name: string },
  fromCamera: boolean,
  now: Date
) => {
  const fromFile = file.name.replace(/\.[^./]+$/, '').trim()
  const name =
    fromCamera || !fromFile
      ? `Foto del ${format(now, 'd MMM, HH:mm', { locale: es })}`
      : fromFile
  return name.slice(0, TRIP_DOCUMENT_LIMITS.name)
}

/** "300 KB", "1.2 MB" */
export const fileSizeText = (bytes: number) =>
  bytes < MB
    ? `${String(Math.max(1, Math.round(bytes / 1024)))} KB`
    : `${(bytes / MB).toFixed(1)} MB`

/** Who renames or deletes it (RF-4): the owner, the supervisor, or its author. */
export const canManageDocument = (
  role: Role | null | undefined,
  uid: string,
  document: Pick<TripDocument, 'createdBy'>
) =>
  role === 'owner' ||
  role === 'supervisor' ||
  (canWriteFleet(role) && document.createdBy === uid)

/** Its name, when uploading or renaming it (RF-10, RF-12). */
export const documentNameSchema = z.object({
  name: requiredText('Escribe un nombre', TRIP_DOCUMENT_LIMITS.name),
})
export type DocumentNameValues = z.infer<typeof documentNameSchema>
