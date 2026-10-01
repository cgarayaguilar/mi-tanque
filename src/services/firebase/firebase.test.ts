import { authDomainFor, emulatorHostFor } from 'services/firebase/config'
import type * as Config from 'services/firebase/config'

const sdk = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: 'app' })),
  getApps: vi.fn((): unknown[] => []),
  deleteApp: vi.fn(() => Promise.resolve()),
  getAuth: vi.fn(() => ({
    name: 'auth',
    settings: {},
  })),
  connectAuthEmulator: vi.fn(),
  signOut: vi.fn(() => Promise.resolve()),
  initializeFirestore: vi.fn(() => ({ name: 'db' })),
  getFirestore: vi.fn(() => ({ name: 'existing-db' })),
  persistentLocalCache: vi.fn((options: unknown) => ({ options })),
  persistentMultipleTabManager: vi.fn(() => 'tabs'),
  connectFirestoreEmulator: vi.fn(),
  terminate: vi.fn(() => Promise.resolve()),
  clearIndexedDbPersistence: vi.fn(() => Promise.resolve()),
  getFunctions: vi.fn(() => ({ name: 'functions' })),
  connectFunctionsEmulator: vi.fn(),
  initializeAppCheck: vi.fn(),
  ReCaptchaEnterpriseProvider: vi.fn(function (
    this: { key: string },
    key: string
  ) {
    this.key = key
  }),
}))

// The site key is empty until the owner creates it (specs/0008)
const config = vi.hoisted(() => ({ siteKey: '' }))
vi.mock('services/firebase/config', async importOriginal => ({
  ...(await importOriginal<typeof Config>()),
  get RECAPTCHA_SITE_KEY() {
    return config.siteKey
  },
}))

vi.mock('firebase/app', () => ({
  initializeApp: sdk.initializeApp,
  getApps: sdk.getApps,
  deleteApp: sdk.deleteApp,
}))
vi.mock('firebase/auth', () => ({
  getAuth: sdk.getAuth,
  connectAuthEmulator: sdk.connectAuthEmulator,
  signOut: sdk.signOut,
}))
vi.mock('firebase/firestore', () => ({
  initializeFirestore: sdk.initializeFirestore,
  getFirestore: sdk.getFirestore,
  persistentLocalCache: sdk.persistentLocalCache,
  persistentMultipleTabManager: sdk.persistentMultipleTabManager,
  connectFirestoreEmulator: sdk.connectFirestoreEmulator,
  terminate: sdk.terminate,
  clearIndexedDbPersistence: sdk.clearIndexedDbPersistence,
}))
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: sdk.initializeAppCheck,
  ReCaptchaEnterpriseProvider: sdk.ReCaptchaEnterpriseProvider,
}))
vi.mock('firebase/functions', () => ({
  getFunctions: sdk.getFunctions,
  connectFunctionsEmulator: sdk.connectFunctionsEmulator,
}))

// Fresh module per test: the services are memoized at module level
const load = async () => {
  vi.resetModules()
  return import('services/firebase')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  config.siteKey = ''
})

test('initializes the app once, with a persistent cache and Functions in us-central1', async () => {
  const { loadFirebase } = await load()

  const [first, second] = await Promise.all([loadFirebase(), loadFirebase()])

  expect(first).toBe(second)
  expect(sdk.initializeApp).toHaveBeenCalledTimes(1)
  expect(sdk.initializeApp).toHaveBeenCalledWith(
    expect.objectContaining({
      projectId: 'mi-tanque-60015',
      // jsdom runs on localhost: the default auth domain
      authDomain: 'mi-tanque-60015.firebaseapp.com',
    })
  )
  expect(sdk.initializeFirestore).toHaveBeenCalledWith(first.app, {
    localCache: { options: { tabManager: 'tabs' } },
  })
  expect(sdk.getFunctions).toHaveBeenCalledWith(first.app, 'us-central1')
  expect(sdk.connectAuthEmulator).not.toHaveBeenCalled()
})

test('connects every service to the local emulators when asked', async () => {
  vi.stubEnv('VITE_USE_EMULATORS', 'true')
  const { loadFirebase } = await load()

  const { auth, db, functions } = await loadFirebase()

  expect(sdk.connectAuthEmulator).toHaveBeenCalledWith(
    auth,
    'http://localhost:9099',
    { disableWarnings: true }
  )
  expect(auth.settings.appVerificationDisabledForTesting).toBe(true)
  expect(sdk.connectFirestoreEmulator).toHaveBeenCalledWith(
    db,
    'localhost',
    8080
  )
  expect(sdk.connectFunctionsEmulator).toHaveBeenCalledWith(
    functions,
    'localhost',
    5001
  )
})

test('a failed load is retried on the next call', async () => {
  const { loadFirebase } = await load()
  sdk.initializeApp.mockImplementationOnce(() => {
    throw new Error('offline')
  })

  await expect(loadFirebase()).rejects.toThrow('offline')
  await expect(loadFirebase()).resolves.toMatchObject({ app: { name: 'app' } })
})

// specs/0002 RF-14: a shared phone keeps nothing of the account
test('signing out clears the cached account data and starts over', async () => {
  const { loadFirebase, signOutAndClearFirebase } = await load()
  const { db } = await loadFirebase()

  await signOutAndClearFirebase()

  expect(sdk.signOut).toHaveBeenCalled()
  expect(sdk.terminate).toHaveBeenCalledWith(db)
  expect(sdk.clearIndexedDbPersistence).toHaveBeenCalledWith(db)
  expect(sdk.deleteApp).toHaveBeenCalled()
  await loadFirebase()
  expect(sdk.initializeApp).toHaveBeenCalledTimes(2)
})

test('Google sign-in goes through our own domain only in production', () => {
  expect(authDomainFor('solocamioneros.com')).toBe('solocamioneros.com')
  expect(authDomainFor('localhost')).toBe('mi-tanque-60015.firebaseapp.com')
  expect(authDomainFor('mi-tanque-git-x.vercel.app')).toBe(
    'mi-tanque-60015.firebaseapp.com'
  )
})

test('the emulators are reached with the same host name as the page', () => {
  expect(emulatorHostFor('localhost')).toBe('localhost')
  expect(emulatorHostFor('marca.localhost')).toBe('marca.localhost')
  expect(emulatorHostFor('127.0.0.1')).toBe('127.0.0.1')
})

// Vite's hot reload re-runs this module while the Firebase app lives on
test('reuses an app that already exists instead of setting it up again', async () => {
  vi.stubEnv('VITE_USE_EMULATORS', 'true')
  sdk.getApps.mockReturnValueOnce([{ name: 'app' }])
  const { loadFirebase } = await load()

  const { db } = await loadFirebase()

  expect(sdk.initializeApp).not.toHaveBeenCalled()
  expect(sdk.initializeFirestore).not.toHaveBeenCalled()
  expect(db).toEqual({ name: 'existing-db' })
  expect(sdk.connectFirestoreEmulator).not.toHaveBeenCalled()
})

describe('App Check (specs/0008 RF-7, RF-8)', () => {
  test('starts with Fraud Defense and token refresh, once, before the other services', async () => {
    config.siteKey = 'site-key'
    const { loadFirebase } = await load()
    await Promise.all([loadFirebase(), loadFirebase()])

    expect(sdk.initializeAppCheck).toHaveBeenCalledTimes(1)
    expect(sdk.initializeAppCheck).toHaveBeenCalledWith(
      { name: 'app' },
      { provider: { key: 'site-key' }, isTokenAutoRefreshEnabled: true }
    )
    expect(sdk.initializeAppCheck.mock.invocationCallOrder[0]).toBeLessThan(
      sdk.getAuth.mock.invocationCallOrder[0] ?? 0
    )
  })

  test('not with the emulators, nor without a site key', async () => {
    config.siteKey = 'site-key'
    vi.stubEnv('VITE_USE_EMULATORS', 'true')
    await (await load()).loadFirebase()
    vi.unstubAllEnvs()
    config.siteKey = ''
    await (await load()).loadFirebase()
    expect(sdk.initializeAppCheck).not.toHaveBeenCalled()
  })

  test("the basic mode's place lookup gets App Check and Functions, never Firestore (RF-5)", async () => {
    config.siteKey = 'site-key'
    vi.resetModules()
    const { firebaseApp, functionsFor } = await import('services/firebase/core')
    functionsFor(firebaseApp().app)
    expect(sdk.initializeAppCheck).toHaveBeenCalledTimes(1)
    expect(sdk.getFunctions).toHaveBeenCalledWith(
      { name: 'app' },
      'us-central1'
    )
    expect(sdk.initializeFirestore).not.toHaveBeenCalled()
    expect(sdk.getAuth).not.toHaveBeenCalled()
  })
})
