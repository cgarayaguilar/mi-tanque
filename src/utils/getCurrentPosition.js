// Resolves with the device coordinates, or null when geolocation is unavailable,
// denied or times out. Asked on demand so nothing keeps watching the GPS.
export const getCurrentPosition = ({
  timeout = 10000,
  maximumAge = 5 * 60 * 1000,
} = {}) =>
  new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)

    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => resolve(null),
      { timeout, maximumAge }
    )
  })
