import * as z from 'zod/mini'
import type { Coordinates } from 'utils/getCurrentPosition'

// ⚠️ This key ships in the bundle until the backend exists (§5.5, ADR 0001):
// it moves to a callable with Secret Manager and gets rotated then
const REVERSE_GEOCODE_URL = 'https://app.geocodeapi.io/api/v1/reverse'
const API_KEY = '6384fa00-7b09-11eb-b491-2511be64546d'

const responseSchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        locality: z.optional(z.string()),
        country: z.optional(z.string()),
      }),
    })
  ),
})

/** "Locality, Country" for the coordinates, or null when the API knows no place. */
export const getPlaceName = async ({
  latitude,
  longitude,
}: Coordinates): Promise<string | null> => {
  const response = await fetch(
    `${REVERSE_GEOCODE_URL}?point.lat=${String(latitude)}&point.lon=${String(longitude)}&apikey=${API_KEY}`
  )
  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with ${String(response.status)}`)
  }

  const place = responseSchema.parse(await response.json()).features[0]
    ?.properties
  const name = [place?.locality, place?.country].filter(Boolean).join(', ')

  return name === '' ? null : name
}
