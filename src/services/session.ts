// The signed-in mode's access to Firebase. It imports the SDK statically, so
// only lazy pages import it directly; the session store loads it with
// import() to keep the SDK out of the basic mode (specs/0000 RNF-1).
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  type Unsubscribe,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  waitForPendingWrites,
  where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import * as z from 'zod/mini'
import { CURRENCIES, type Currency } from 'schemas/account'
import { loadFirebase, signOutAndClearFirebase } from 'services/firebase'
import { ROLES } from 'utils/roles'

export interface SessionUser {
  uid: string
  displayName: string | null
  email: string | null
  phoneNumber: string | null
}

const toSessionUser = (user: User): SessionUser => ({
  uid: user.uid,
  displayName: user.displayName,
  email: user.email,
  phoneNumber: user.phoneNumber,
})

/** Calls back with the signed-in user, or null, now and on every change. */
export const subscribeToAuth = async (
  onChange: (user: SessionUser | null) => void
): Promise<Unsubscribe> => {
  const { auth } = await loadFirebase()
  return onAuthStateChanged(auth, user => {
    onChange(user ? toSessionUser(user) : null)
  })
}

/** Finishes a Google redirect sign-in after the page comes back, if any. */
export const completeRedirectSignIn = async (): Promise<void> => {
  const { auth } = await loadFirebase()
  await getRedirectResult(auth)
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches

/**
 * Google sign-in: a popup, or a full redirect when the app is installed or
 * the browser blocks the popup (specs/0002 RF-2).
 */
export const signInWithGoogle = async (): Promise<void> => {
  const { auth } = await loadFirebase()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  if (isStandalone()) {
    await signInWithRedirect(auth, provider)
    return
  }
  try {
    await signInWithPopup(auth, provider)
  } catch (error) {
    if ((error as { code?: unknown }).code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider)
      return
    }
    throw error
  }
}

export interface PhoneVerification {
  confirm: (code: string) => Promise<void>
}

/** Sends the SMS code; `container` hosts the invisible reCAPTCHA. */
export const sendPhoneCode = async (
  e164: string,
  container: HTMLElement
): Promise<PhoneVerification> => {
  const { auth } = await loadFirebase()
  // A fresh element on every send: reCAPTCHA renders once per element, and
  // clear() leaves an invisible widget's element taken, so "Resend code" or
  // another number failed with "already been rendered in this element"
  const host = document.createElement('div')
  container.replaceChildren(host)
  const verifier = new RecaptchaVerifier(auth, host, { size: 'invisible' })
  try {
    const confirmation = await signInWithPhoneNumber(auth, e164, verifier)
    return {
      confirm: async code => {
        await confirmation.confirm(code)
      },
    }
  } finally {
    verifier.clear()
  }
}

// Storage boundary (§6.4): documents written by the `account` callable
const profileSchema = z.object({
  displayName: z.string(),
  // null after leaving or being removed from the last one (specs/0005)
  activeOrgId: z.nullable(z.string()),
})
const membershipSchema = z.object({
  orgId: z.string(),
  role: z.enum(ROLES),
  orgName: z.string(),
})
const organizationSchema = z.object({
  name: z.string(),
  defaultCurrency: z.enum(CURRENCIES),
  // Missing in organizations from before specs/0010: see utils/distanceUnit
  distanceUnit: z.optional(z.nullable(z.enum(['km', 'mi']))),
})

export type Profile = z.infer<typeof profileSchema>
export type Membership = z.infer<typeof membershipSchema>
export type Organization = z.infer<typeof organizationSchema> & { id: string }

export interface Account {
  /** null: first sign-in, the welcome screen creates it. */
  profile: Profile | null
  memberships: Membership[]
  /** null with a profile: no organization left, the welcome creates one. */
  organization: Organization | null
  /** Memberships from before specs/0005 lack the contact (RF-15). */
  needsContactSync: boolean
}

// A person belongs to a handful of organizations; bounded anyway (§2.3)
const MAX_MEMBERSHIPS = 50

export const readAccount = async (uid: string): Promise<Account> => {
  const { db } = await loadFirebase()
  const [profileSnapshot, membershipsSnapshot] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDocs(
      query(
        collection(db, 'members'),
        where('uid', '==', uid),
        limit(MAX_MEMBERSHIPS)
      )
    ),
  ])
  if (!profileSnapshot.exists()) {
    return {
      profile: null,
      memberships: [],
      organization: null,
      needsContactSync: false,
    }
  }

  const stored = profileSchema.parse(profileSnapshot.data())
  const memberships = membershipsSnapshot.docs
    .map(snapshot => membershipSchema.parse(snapshot.data()))
    .sort((a, b) => a.orgName.localeCompare(b.orgName, 'es'))
  const needsContactSync = membershipsSnapshot.docs.some(
    snapshot => !('phoneNumber' in snapshot.data())
  )
  // The active org may be gone (removed, left): fall back to another one
  const activeOrgId = memberships.some(m => m.orgId === stored.activeOrgId)
    ? stored.activeOrgId
    : (memberships[0]?.orgId ?? null)
  const profile = { ...stored, activeOrgId }
  if (activeOrgId === null) {
    return { profile, memberships, organization: null, needsContactSync }
  }

  const organizationSnapshot = await getDoc(
    doc(db, 'organizations', activeOrgId)
  )
  const organization = organizationSnapshot.exists()
    ? {
        id: organizationSnapshot.id,
        ...organizationSchema.parse(organizationSnapshot.data()),
      }
    : null

  return { profile, memberships, organization, needsContactSync }
}

export type AccountRequest =
  | { action: 'warmup' }
  | {
      action: 'bootstrap'
      displayName?: string
      orgName: string
      currency: Currency
    }
  | { action: 'updateProfile'; displayName: string }
  | {
      action: 'updateOrganization'
      orgId: string
      name?: string
      defaultCurrency?: Currency
    }
  | { action: 'createOrganization'; name: string; currency: Currency }
  | { action: 'deleteAccount' }
  | { action: 'syncContact' }

/** The backend `account` callable (specs/0002, 0005). Needs a connection. */
export const callAccount = async (
  request: AccountRequest
): Promise<unknown> => {
  const { functions } = await loadFirebase()
  const result = await httpsCallable(functions, 'account')(request)
  return result.data
}

/**
 * Starts the callable's instance while the user fills a form (§3.8.4). A
 * failure is ignored on purpose: it is not a user action.
 */
export const warmUpAccount = (): void => {
  callAccount({ action: 'warmup' }).catch(() => undefined)
}

/**
 * Switches the active organization. Not awaited by the UI: offline, the
 * write waits in the queue and the rules check the membership on sync.
 */
export const setActiveOrganization = async (uid: string, orgId: string) => {
  const { db } = await loadFirebase()
  await updateDoc(doc(db, 'users', uid), {
    activeOrgId: orgId,
    updatedAt: serverTimestamp(),
  })
}

/** True when local changes are still waiting to reach the server. */
export const hasPendingWrites = async (timeoutMs = 1500): Promise<boolean> => {
  const { db } = await loadFirebase()
  const synced = waitForPendingWrites(db).then(() => false)
  const timeout = new Promise<boolean>(resolve =>
    setTimeout(() => {
      resolve(true)
    }, timeoutMs)
  )
  return Promise.race([synced, timeout])
}

export { signOutAndClearFirebase as signOutAndClear }
