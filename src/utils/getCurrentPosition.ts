export interface Coordinates {
  latitude: number
  longitude: number
}

export interface Position extends Coordinates {
  /** Meters (68% confidence radius). */
  accuracy: number
}

// Resolves with the device coordinates, or null when geolocation is unavailable,
// denied or times out. Asked on demand so nothing keeps watching the GPS.
export const getCurrentPosition = ({
  timeout = 10000,
  maximumAge = 5 * 60 * 1000,
}: {
  timeout?: number
  maximumAge?: number
} = {}): Promise<Position | null> =>
  new Promise(resolve => {
    if (!('geolocation' in navigator)) {
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        })
      },
      () => {
        resolve(null)
      },
      { timeout, maximumAge }
    )
  })
