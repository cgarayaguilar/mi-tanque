const sdk = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: 'app' })),
  getAuth: vi.fn(() => ({ name: 'auth' })),
  connectAuthEmulator: vi.fn(),
  initializeFirestore: vi.fn(() => ({ name: 'db' })),
  persistentLocalCache: vi.fn((options: unknown) => ({ options })),
  persistentMultipleTabManager: vi.fn(() => 'tabs'),
  connectFirestoreEmulator: vi.fn(),
}))

vi.mock('firebase/app', () => ({ initializeApp: sdk.initializeApp }))
vi.mock('firebase/auth', () => ({
  getAuth: sdk.getAuth,
  connectAuthEmulator: sdk.connectAuthEmulator,
}))
vi.mock('firebase/firestore', () => ({
  initializeFirestore: sdk.initializeFirestore,
  persistentLocalCache: sdk.persistentLocalCache,
  persistentMultipleTabManager: sdk.persistentMultipleTabManager,
  connectFirestoreEmulator: sdk.connectFirestoreEmulator,
}))

// Fresh module per test: the services are memoized at module level
const load = async () => {
  vi.resetModules()
  const { loadFirebase } = await import('services/firebase')
  return loadFirebase
}

afterEach(() => {
  vi.unstubAllEnvs()
})

test('initializes the app once, with a persistent offline cache', async () => {
  const loadFirebase = await load()

  const [first, second] = await Promise.all([loadFirebase(), loadFirebase()])

  expect(first).toBe(second)
  expect(sdk.initializeApp).toHaveBeenCalledTimes(1)
  expect(sdk.initializeApp).toHaveBeenCalledWith(
    expect.objectContaining({ projectId: 'mi-tanque-60015' })
  )
  expect(sdk.initializeFirestore).toHaveBeenCalledWith(first.app, {
    localCache: { options: { tabManager: 'tabs' } },
  })
  expect(sdk.connectAuthEmulator).not.toHaveBeenCalled()
})

test('connects to the local emulators when asked', async () => {
  vi.stubEnv('VITE_USE_EMULATORS', 'true')
  const loadFirebase = await load()

  const { auth, db } = await loadFirebase()

  expect(sdk.connectAuthEmulator).toHaveBeenCalledWith(
    auth,
    'http://127.0.0.1:9099',
    { disableWarnings: true }
  )
  expect(sdk.connectFirestoreEmulator).toHaveBeenCalledWith(
    db,
    '127.0.0.1',
    8080
  )
})

test('a failed load is retried on the next call', async () => {
  const loadFirebase = await load()
  sdk.initializeApp.mockImplementationOnce(() => {
    throw new Error('offline')
  })

  await expect(loadFirebase()).rejects.toThrow('offline')
  await expect(loadFirebase()).resolves.toMatchObject({ app: { name: 'app' } })
})
