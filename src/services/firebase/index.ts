// Imported only by services/session, which the session store loads with
// import(): the SDK lives in that chunk and the basic mode never downloads it.
import {
  deleteApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from 'firebase/app'
import { connectAuthEmulator, getAuth, signOut, type Auth } from 'firebase/auth'
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from 'firebase/firestore'
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from 'firebase/functions'
import {
  authDomainFor,
  emulatorHostFor,
  EMULATORS,
  firebaseConfig,
  FUNCTIONS_REGION,
} from './config'

export interface FirebaseServices {
  app: FirebaseApp
  auth: Auth
  db: Firestore
  functions: Functions
}

let services: Promise<FirebaseServices> | null = null

const emulatorsEnabled = () => import.meta.env.VITE_USE_EMULATORS === 'true'

const initialize = (): FirebaseServices => {
  // An app that outlived this module (Vite hot reload) is reused: Firestore
  // and the emulators can only be set up once per app
  const existing = getApps()[0]
  const app =
    existing ??
    initializeApp({
      ...firebaseConfig,
      authDomain: authDomainFor(window.location.hostname),
    })
  const auth = getAuth(app)
  auth.languageCode = 'es'
  // Persistent cache: reads work and writes queue while a driver has no
  // signal, then sync (backend ADR 0003)
  const db = existing
    ? getFirestore(app)
    : initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      })
  const functions = getFunctions(app, FUNCTIONS_REGION)

  if (!existing && emulatorsEnabled()) {
    const host = emulatorHostFor(window.location.hostname)
    connectAuthEmulator(auth, `http://${host}:${String(EMULATORS.auth)}`, {
      disableWarnings: true,
    })
    // The emulator does not run reCAPTCHA
    auth.settings.appVerificationDisabledForTesting = true
    connectFirestoreEmulator(db, host, EMULATORS.firestore)
    connectFunctionsEmulator(functions, host, EMULATORS.functions)
  }

  return { app, auth, db, functions }
}

/**
 * The Firebase services of the signed-in mode, created once on first use. A
 * failed start is not cached, so the next call retries.
 */
export const loadFirebase = (): Promise<FirebaseServices> => {
  services ??= Promise.resolve()
    .then(initialize)
    .catch((error: unknown) => {
      services = null
      throw error
    })
  return services
}

/**
 * Signs out and deletes the account data cached on this phone (specs/0002
 * RF-14): several drivers can share one device. The next loadFirebase()
 * starts from scratch.
 */
export const signOutAndClearFirebase = async (): Promise<void> => {
  if (!services) return
  const { app, auth, db } = await services
  await signOut(auth)
  await terminate(db)
  await clearIndexedDbPersistence(db)
  await deleteApp(app)
  services = null
}
