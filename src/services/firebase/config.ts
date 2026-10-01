import type { FirebaseOptions } from 'firebase/app'

/**
 * Web config of the Firebase project `mi-tanque-60015` (us-central1). It is
 * public by design: security comes from the Firestore and Storage rules and
 * from restricting this API key to our domains, not from hiding it (§5.5).
 * Analytics is off (backend ADR 0001), so there is no measurementId.
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyAr0wX3mQjE1shga4HbY0iSFmPOPuB6pA4',
  authDomain: 'mi-tanque-60015.firebaseapp.com',
  projectId: 'mi-tanque-60015',
  storageBucket: 'mi-tanque-60015.firebasestorage.app',
  messagingSenderId: '691185265611',
  appId: '1:691185265611:web:8094dc186574c667ab644e',
}

/** Same region as Firestore: Functions are deployed there. */
export const FUNCTIONS_REGION = 'us-central1'

/** Local emulator ports (solocamioneros-backend/firebase.json). */
export const EMULATORS = {
  host: '127.0.0.1',
  auth: 9099,
  firestore: 8080,
} as const
