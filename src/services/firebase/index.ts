import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { EMULATORS, firebaseConfig } from './config'

export interface FirebaseServices {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

let services: Promise<FirebaseServices> | null = null

const initialize = async (): Promise<FirebaseServices> => {
  // Imported here, not at the top: the basic mode never downloads the SDK
  const [{ initializeApp }, authSdk, firestoreSdk] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ])

  const app = initializeApp(firebaseConfig)
  const auth = authSdk.getAuth(app)
  // Persistent cache: reads work and writes queue while a driver has no
  // signal, then sync (backend ADR 0003)
  const db = firestoreSdk.initializeFirestore(app, {
    localCache: firestoreSdk.persistentLocalCache({
      tabManager: firestoreSdk.persistentMultipleTabManager(),
    }),
  })

  if (import.meta.env.VITE_USE_EMULATORS === 'true') {
    authSdk.connectAuthEmulator(
      auth,
      `http://${EMULATORS.host}:${String(EMULATORS.auth)}`,
      { disableWarnings: true }
    )
    firestoreSdk.connectFirestoreEmulator(
      db,
      EMULATORS.host,
      EMULATORS.firestore
    )
  }

  return { app, auth, db }
}

/**
 * The Firebase services of the signed-in mode, created once on first use.
 * A failed load (offline on the first visit) is not cached, so the next call
 * retries.
 */
export const loadFirebase = (): Promise<FirebaseServices> => {
  services ??= initialize().catch((error: unknown) => {
    services = null
    throw error
  })
  return services
}
