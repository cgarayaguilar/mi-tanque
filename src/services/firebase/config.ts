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

const CANONICAL_HOST = 'solocamioneros.com'

/**
 * On the production domain, Google sign-in goes through our own origin
 * (Vercel proxies /__/auth to Firebase): browsers block the third-party
 * storage a firebaseapp.com authDomain needs for redirects (specs/0002).
 * Localhost and previews keep the default one and use the popup.
 */
export const authDomainFor = (hostname: string): string =>
  hostname === CANONICAL_HOST
    ? CANONICAL_HOST
    : (firebaseConfig.authDomain ?? CANONICAL_HOST)

/** Same region as Firestore: Functions are deployed there. */
export const FUNCTIONS_REGION = 'us-central1'

/**
 * The emulators' host, as the page names it: `localhost` and `127.0.0.1` are
 * different sites, and Google sign-in's redirect needs the Auth emulator's
 * iframe to be same-site (else the browser blocks its storage).
 */
export const emulatorHostFor = (hostname: string): string =>
  hostname === 'localhost' || hostname.endsWith('.localhost')
    ? hostname
    : '127.0.0.1'

/** Local emulator ports (solocamioneros-backend/firebase.json). */
export const EMULATORS = {
  auth: 9099,
  firestore: 8080,
  functions: 5001,
  storage: 9199,
} as const
