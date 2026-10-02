// The Firebase app with App Check, and Functions (backend specs/0008). No
// Auth or Firestore here: the basic mode loads only this, and only when a
// measurement needs its place.
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check'
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
import { reportError } from 'utils/reportError'

export const emulatorsEnabled = () =>
  import.meta.env.VITE_USE_EMULATORS === 'true'

// reCAPTCHA Enterprise, loaded by us (the same script the App Check SDK
// loads): the SDK has no error handler for it, so when it is blocked (privacy
// DNS, strict browsers) App Check waits forever, and Auth and Functions wait
// for App Check. Long enough for a slow phone network.
const RECAPTCHA_SCRIPT =
  'https://www.google.com/recaptcha/enterprise.js?render=explicit'
export const RECAPTCHA_TIMEOUT_MS = 10_000

let recaptcha: Promise<boolean> | null = null

/** Whether reCAPTCHA is ready; a failed load is tried again next time. */
const loadRecaptcha = (): Promise<boolean> => {
  recaptcha ??= new Promise<boolean>(resolve => {
    const loaded = (window as { grecaptcha?: { enterprise?: unknown } })
      .grecaptcha?.enterprise
    if (loaded) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = RECAPTCHA_SCRIPT
    const timer = setTimeout(() => {
      resolve(false)
    }, RECAPTCHA_TIMEOUT_MS)
    script.onload = () => {
      clearTimeout(timer)
      resolve(true)
    }
    script.onerror = () => {
      clearTimeout(timer)
      script.remove()
      resolve(false)
    }
    document.head.appendChild(script)
  }).then(ready => {
    if (!ready) recaptcha = null
    return ready
  })
  return recaptcha
}

// Per app, not a module flag: signing out deletes the app, and the next one
// needs App Check again (a shared phone, specs/0002 RF-14)
const appChecks = new WeakMap<FirebaseApp, Promise<void>>()

/**
 * App Check with Fraud Defense (reCAPTCHA Enterprise), before any other
 * service sends a request (RF-7). Not with the emulators, which do not check
 * it (RF-8); with a debug token in development against the real project.
 * Without reCAPTCHA the app goes on without App Check: while it is only
 * monitored nothing is lost, and once it is enforced the calls fail with an
 * error instead of hanging.
 */
const startAppCheck = async (app: FirebaseApp) => {
  if (emulatorsEnabled() || !RECAPTCHA_SITE_KEY) return
  if (!(await loadRecaptcha())) {
    reportError(new Error('reCAPTCHA did not load'), {
      operation: 'startAppCheck',
    })
    return
  }
  if (import.meta.env.DEV) {
    // The SDK prints a debug token to register in the Firebase console
    ;(
      self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
}

/**
 * The app, created once and with App Check started. Reused if it already
 * exists: the signed-in mode, the basic mode's place lookup and Vite's hot
 * reload all share it.
 */
export const firebaseApp = async (): Promise<FirebaseApp> => {
  const app =
    getApps()[0] ??
    initializeApp({
      ...firebaseConfig,
      authDomain: authDomainFor(window.location.hostname),
    })
  let appCheck = appChecks.get(app)
  if (!appCheck) {
    appCheck = startAppCheck(app)
    appChecks.set(app, appCheck)
  }
  await appCheck
  return app
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
