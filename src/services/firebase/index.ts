// Imported only by services/session, which the session store loads with
// import(): the SDK lives in that chunk and the basic mode never downloads it.
import { deleteApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signOut, type Auth } from 'firebase/auth'
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  disableNetwork,
  enableNetwork,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from 'firebase/firestore'
import type { Functions } from 'firebase/functions'
import type { FirebaseStorage } from 'firebase/storage'
import { reportError } from 'utils/reportError'
import { setSlowConnectionHandler } from 'utils/withTimeout'
import { emulatorHostFor, EMULATORS } from './config'
import { emulatorsEnabled, firebaseApp, functionsFor } from './core'

export interface FirebaseServices {
  app: FirebaseApp
  auth: Auth
  db: Firestore
  functions: Functions
}

let services: Promise<FirebaseServices> | null = null

// Shared across module reloads (Symbol.for), unlike a module variable
const SIGNED_IN_SETUP = Symbol.for('solocamioneros.signedInSetup')

const initialize = async (): Promise<FirebaseServices> => {
  // App Check starts with the app, before any request (specs/0008)
  const app = await firebaseApp()
  // Firestore and the emulators are set up once per app, and the mark lives
  // on the app: only a Vite hot reload finds it set. Whether the app is new
  // says nothing, since the basic mode's place lookup may have created it
  const marked = app as FirebaseApp & { [SIGNED_IN_SETUP]?: true }
  const ready = marked[SIGNED_IN_SETUP] === true
  const auth = getAuth(app)
  auth.languageCode = 'es'
  // Persistent cache: reads work and writes queue while a driver has no
  // signal, then sync (backend ADR 0003)
  const db = ready
    ? getFirestore(app)
    : initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      })
  const functions = functionsFor(app)

  if (!ready && emulatorsEnabled()) {
    const host = emulatorHostFor(window.location.hostname)
    connectAuthEmulator(auth, `http://${host}:${String(EMULATORS.auth)}`, {
      disableWarnings: true,
    })
    // The emulator does not run reCAPTCHA
    auth.settings.appVerificationDisabledForTesting = true
    connectFirestoreEmulator(db, host, EMULATORS.firestore)
  }

  marked[SIGNED_IN_SETUP] = true
  setSlowConnectionHandler(() => {
    restartConnection(db)
  })
  return { app, auth, db, functions }
}

let restarting: Promise<void> | null = null

/**
 * A read ran out of time (specs/0020 RF-5): Firestore can be waiting on a
 * connection that hung without failing, as on an installed iPhone app, and
 * every retry would wait on it too. Closing and opening the network makes
 * the next read use a new one; queued writes stay queued and go out after.
 */
const restartConnection = (db: Firestore) => {
  restarting ??= disableNetwork(db)
    .then(() => enableNetwork(db))
    .catch((error: unknown) => {
      reportError(error, { operation: 'restartConnection' })
    })
    .finally(() => {
      restarting = null
    })
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

let storage: Promise<FirebaseStorage> | null = null

/**
 * Storage, only for fleet photos: its SDK loads on the first photo shown or
 * uploaded, not with the rest of the signed-in mode.
 */
export const loadStorage = (): Promise<FirebaseStorage> => {
  storage ??= Promise.all([loadFirebase(), import('firebase/storage')])
    .then(([{ app }, storageSdk]) => {
      const instance = storageSdk.getStorage(app)
      if (emulatorsEnabled()) {
        storageSdk.connectStorageEmulator(
          instance,
          emulatorHostFor(window.location.hostname),
          EMULATORS.storage
        )
      }
      return instance
    })
    .catch((error: unknown) => {
      storage = null
      throw error
    })
  return storage
}

/**
 * Signs out and deletes the account data cached on this phone (specs/0002
 * RF-14): several drivers can share one device. The next loadFirebase()
 * starts from scratch.
 */
export const signOutAndClearFirebase = async (): Promise<void> => {
  if (!services) return
  const { app, auth, db } = await services
  setSlowConnectionHandler(() => undefined)
  await signOut(auth)
  await terminate(db)
  await clearIndexedDbPersistence(db)
  await deleteApp(app)
  services = null
  storage = null
}
