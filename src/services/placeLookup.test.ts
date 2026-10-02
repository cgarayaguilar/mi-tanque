import { lookupPlace } from 'services/placeLookup'

const sdk = vi.hoisted(() => ({
  call: vi.fn(),
  httpsCallable: vi.fn(),
}))
vi.mock('firebase/functions', () => ({ httpsCallable: sdk.httpsCallable }))
vi.mock('services/firebase/core', () => ({
  firebaseApp: () => Promise.resolve({ name: 'app' }),
  functionsFor: () => ({ name: 'functions' }),
}))

beforeEach(() => {
  sdk.httpsCallable.mockReturnValue(sdk.call)
})

afterEach(() => {
  vi.clearAllMocks()
})

test('asks the geocode function and keeps the basic mode\'s "City, Country" (RF-4)', async () => {
  sdk.call.mockResolvedValue({
    data: {
      city: 'Managua',
      state: 'Managua',
      country: 'Nicaragua',
      countryCode: 'NI',
    },
  })
  await expect(
    lookupPlace({ latitude: 12.13, longitude: -86.25 })
  ).resolves.toBe('Managua, Nicaragua')
  expect(sdk.httpsCallable).toHaveBeenCalledWith(
    { name: 'functions' },
    'geocode'
  )
  expect(sdk.call).toHaveBeenCalledWith({ lat: 12.13, lng: -86.25 })
})

test('without a city, the state; without a place, null', async () => {
  sdk.call.mockResolvedValueOnce({
    data: {
      city: null,
      state: 'Río San Juan',
      country: 'Nicaragua',
      countryCode: 'NI',
    },
  })
  await expect(lookupPlace({ latitude: 11, longitude: -84 })).resolves.toBe(
    'Río San Juan, Nicaragua'
  )
  sdk.call.mockResolvedValueOnce({ data: null })
  await expect(lookupPlace({ latitude: 0, longitude: 0 })).resolves.toBeNull()
})

test('a malformed answer is an error, never a wrong place', async () => {
  sdk.call.mockResolvedValue({ data: { city: 3 } })
  await expect(lookupPlace({ latitude: 1, longitude: 1 })).rejects.toThrow()
})
