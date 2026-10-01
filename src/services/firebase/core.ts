// The Firebase app with App Check, and Functions (backend specs/0008). No
// Auth or Firestore here: the basic mode loads only this, and only when a
// measurement needs its place.
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
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
  RECAPTCHA_SITE_KEY,
} from './config'

export const emulatorsEnabled = () =>
  import.meta.env.VITE_USE_EMULATORS === 'true'

let appCheckStarted = false

/**
 * App Check with reCAPTCHA v3, before any other service sends a request
 * (RF-7). Not with the emulators, which do not check it (RF-8); with a
 * debug token in development against the real project.
 */
const startAppCheck = (app: FirebaseApp) => {
  if (appCheckStarted || emulatorsEnabled() || !RECAPTCHA_SITE_KEY) return
  if (import.meta.env.DEV) {
    // The SDK prints a debug token to register in the Firebase console
    ;(
      self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
  appCheckStarted = true
}

/**
 * The app, created once; reused if it outlived this module (Vite hot
 * reload). `isNew` tells the caller whether services still need setting up.
 */
export const firebaseApp = (): { app: FirebaseApp; isNew: boolean } => {
  const existing = getApps()[0]
  if (existing) return { app: existing, isNew: false }
  const app = initializeApp({
    ...firebaseConfig,
    authDomain: authDomainFor(window.location.hostname),
  })
  startAppCheck(app)
  return { app, isNew: true }
}

const connected = new WeakSet<Functions>()

/** Functions in us-central1, on the emulator when asked, connected once. */
export const functionsFor = (app: FirebaseApp): Functions => {
  const functions = getFunctions(app, FUNCTIONS_REGION)
  if (emulatorsEnabled() && !connected.has(functions)) {
    connectFunctionsEmulator(
      functions,
      emulatorHostFor(window.location.hostname),
      EMULATORS.functions
    )
    connected.add(functions)
  }
  return functions
}
