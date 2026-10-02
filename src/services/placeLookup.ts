// The place of a basic-mode measurement (backend specs/0008 RF-4, RF-5):
// the `geocode` function resolves it with Google; the key never reaches
// the phone. Loaded with import(): app, App Check and Functions, no
// Firestore, and only when a measurement has a location.
import { httpsCallable } from 'firebase/functions'
import * as z from 'zod/mini'
import { firebaseApp, functionsFor } from 'services/firebase/core'
import type { Coordinates } from 'utils/getCurrentPosition'

const placeSchema = z.nullable(
  z.object({
    city: z.nullable(z.string()),
    state: z.nullable(z.string()),
    country: z.string(),
  })
)

/** "City, Country" (as the basic mode always stored it), or null. */
export const lookupPlace = async ({
  latitude,
  longitude,
}: Coordinates): Promise<string | null> => {
  const app = await firebaseApp()
  const result = await httpsCallable(
    functionsFor(app),
    'geocode'
  )({
    lat: latitude,
    lng: longitude,
  })
  const place = placeSchema.parse(result.data)
  if (!place) return null
  return [place.city ?? place.state, place.country].filter(Boolean).join(', ')
}
