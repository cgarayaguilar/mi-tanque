import { create } from 'zustand'
import type { Currency } from 'schemas/account'
import type {
  Membership,
  Organization,
  Profile,
  SessionUser,
} from 'services/session'
import { sileo } from 'sileo'
import { forgetInvitation } from 'utils/pendingInvitation'
import { reportError } from 'utils/reportError'
import { isPermissionDenied } from 'utils/teamErrors'

// import(): the SDK stays out of the basic mode's bundle (specs/0000 RNF-1)
const sessionApi = () => import('services/session')

/**
 * - `signedOut`: basic mode.
 * - `loading`: restoring a session or reading the account.
 * - `needsOnboarding`: signed in, no account yet (welcome screen).
 * - `ready`: signed in with an active organization.
 * - `error`: the account could not be read (offline on first load, …).
 */
export type SessionStatus =
  'signedOut' | 'loading' | 'needsOnboarding' | 'ready' | 'error'

// Remembers that this browser has a session, so the next visit restores it.
// Without the flag the SDK is never downloaded (specs/0002 RF-5).
const HINT_KEY = 'sessionActive'

export const hasHint = () => {
  try {
    return window.localStorage.getItem(HINT_KEY) === 'true'
  } catch {
    return false
  }
}

const setHint = (active: boolean) => {
  try {
    if (active) window.localStorage.setItem(HINT_KEY, 'true')
    else window.localStorage.removeItem(HINT_KEY)
  } catch (error) {
    // Only the next visit's restore depends on it; nothing to tell the user
    reportError(error, { operation: 'writeSessionHint' })
  }
}

interface SessionData {
  status: SessionStatus
  user: SessionUser | null
  profile: Profile | null
  memberships: Membership[]
  organization: Organization | null
}

interface SessionState extends SessionData {
  /** Loads the SDK once and follows the auth state. Idempotent. */
  start: () => Promise<void>
  /** Reads the account of the signed-in user again. */
  refresh: () => Promise<void>
  completeOnboarding: (input: {
    displayName?: string
    orgName: string
    currency: Currency
  }) => Promise<void>
  switchOrganization: (orgId: string) => Promise<void>
  /** Creates one more organization and makes it the active one (specs/0005). */
  createOrganization: (input: {
    name: string
    currency: Currency
  }) => Promise<void>
  /** Deletes the account on the server, then signs out here (RF-14). */
  deleteAccount: () => Promise<void>
  updateProfile: (displayName: string) => Promise<void>
  updateOrganization: (changes: {
    name?: string
    defaultCurrency?: Currency
    distanceUnit?: 'km' | 'mi'
  }) => Promise<void>
  /**
   * 'pendingWrites' when local changes have not reached the server yet; call
   * again with `discardPending` once the user accepts losing them.
   */
  signOut: (options?: {
    discardPending?: boolean
  }) => Promise<'signedOut' | 'pendingWrites'>
}

const EMPTY: SessionData = {
  status: 'signedOut',
  user: null,
  profile: null,
  memberships: [],
  organization: null,
}

let started: Promise<void> | null = null
let listeningOnline = false

// Invoice photos saved without signal go up when there is one (specs/0006
// RF-6). import(): the queue's upload brings the Firebase SDK
const uploadPendingInvoices = (uid: string) => {
  import('services/invoiceQueue')
    .then(queue => queue.processInvoiceQueue(uid))
    .catch((error: unknown) => {
      reportError(error, { operation: 'processInvoiceQueue' })
    })
}

// Signing out in another tab terminates this tab's Firestore too (the shared
// cache is cleared): its client cannot be used again until the page reloads
const isTerminatedClient = (error: unknown) =>
  error instanceof Error && /already been terminated/.test(error.message)

let latestLoad = 0

export const useSessionStore = create<SessionState>()((set, get) => {
  const loadAccount = async (user: SessionUser) => {
    const load = ++latestLoad
    // Only the latest read counts: an older one that ends later (switching
    // organization, signing out meanwhile) must not overwrite it
    const current = () => load === latestLoad && get().user?.uid === user.uid
    set({ status: 'loading', user })
    try {
      const api = await sessionApi()
      const account = await api.readAccount(user.uid)
      if (!current()) return
      const { needsContactSync, ...data } = account
      set({
        ...data,
        status: data.profile && data.organization ? 'ready' : 'needsOnboarding',
      })
      if (data.profile && data.organization) uploadPendingInvoices(user.uid)
      if (needsContactSync) {
        // Once per older account; nothing to tell the user if it fails
        api.callAccount({ action: 'syncContact' }).catch((error: unknown) => {
          reportError(error, { operation: 'syncContact' })
        })
      }
    } catch (error) {
      if (!current()) return
      reportError(error, { operation: 'readAccount' })
      if (isTerminatedClient(error)) {
        window.location.reload()
        return
      }
      set({ status: 'error' })
    }
  }

  return {
    ...EMPTY,
    status: hasHint() ? 'loading' : 'signedOut',

    start: () => {
      started ??= (async () => {
        try {
          const api = await sessionApi()
          if (!listeningOnline) {
            listeningOnline = true
            window.addEventListener('online', () => {
              const { status, user } = get()
              if (status === 'ready' && user) uploadPendingInvoices(user.uid)
            })
          }
          await api.subscribeToAuth(user => {
            setHint(user !== null)
            if (user) void loadAccount(user)
            else set(EMPTY)
          })
        } catch (error) {
          started = null
          reportError(error, { operation: 'startSession' })
          set({ status: hasHint() ? 'error' : 'signedOut' })
          return
        }
        // Apart: the auth listener is already up, so failing here must not
        // start it again (a second listener) nor hide the session
        try {
          const api = await sessionApi()
          await api.completeRedirectSignIn()
        } catch (error) {
          reportError(error, { operation: 'completeRedirectSignIn' })
          sileo.error({
            title: 'No pudimos terminar de entrar con Google',
            description: 'Vuelve a intentarlo.',
          })
        }
      })()
      return started
    },

    refresh: async () => {
      const { user } = get()
      if (user) await loadAccount(user)
      else await get().start()
    },

    completeOnboarding: async input => {
      const api = await sessionApi()
      await api.callAccount({ action: 'bootstrap', ...input })
      await get().refresh()
    },

    switchOrganization: async orgId => {
      const { user, memberships } = get()
      const membership = memberships.find(m => m.orgId === orgId)
      if (!user || !membership) return
      const api = await sessionApi()
      // Not awaited: offline it waits in the queue (services/session)
      api.setActiveOrganization(user.uid, orgId).catch((error: unknown) => {
        reportError(error, { operation: 'setActiveOrganization' })
      })
      set(state => ({
        profile: state.profile && { ...state.profile, activeOrgId: orgId },
      }))
      await get().refresh()
    },

    createOrganization: async ({ name, currency }) => {
      const api = await sessionApi()
      await api.callAccount({ action: 'createOrganization', name, currency })
      await get().refresh()
    },

    deleteAccount: async () => {
      const api = await sessionApi()
      await api.callAccount({ action: 'deleteAccount' })
      // The Auth user is gone: drop the local session and its cache
      await api.signOutAndClear()
      started = null
      setHint(false)
      forgetInvitation()
      set(EMPTY)
    },

    updateProfile: async displayName => {
      const api = await sessionApi()
      await api.callAccount({ action: 'updateProfile', displayName })
      await get().refresh()
    },

    updateOrganization: async changes => {
      const { organization } = get()
      if (!organization) return
      const api = await sessionApi()
      await api.callAccount({
        action: 'updateOrganization',
        orgId: organization.id,
        ...changes,
      })
      await get().refresh()
    },

    signOut: async ({ discardPending = false } = {}) => {
      const api = await sessionApi()
      if (!discardPending && (await api.hasPendingWrites())) {
        return 'pendingWrites'
      }
      await api.signOutAndClear()
      started = null
      setHint(false)
      // An invitation left undecided is not offered to the next account
      // signing in on this phone (audit 2026-10-01)
      forgetInvitation()
      set(EMPTY)
      return 'signedOut'
    },
  }
})

/** The caller's role in the active organization. */
export const selectActiveRole = (state: SessionState) =>
  state.memberships.find(m => m.orgId === state.organization?.id)?.role ?? null

const accessOf = (state: SessionState) =>
  `${state.organization?.id ?? ''}|${selectActiveRole(state) ?? ''}`

/**
 * The rules rejected a write (backend specs/0005 RF-12). Reloads the account
 * and tells the user what happened: their role or membership changed while
 * the app was open, or, if not, the server refused the data itself (the
 * phone's clock ahead, a reading out of range), which is no permission
 * matter. False for any other error, which the caller reports as usual.
 */
export const recoverFromLostPermission = (error: unknown): boolean => {
  if (!isPermissionDenied(error)) return false
  const session = useSessionStore.getState()
  const before = accessOf(session)
  void session
    .refresh()
    .catch(() => undefined)
    .then(() => {
      if (accessOf(useSessionStore.getState()) !== before) {
        sileo.warning({
          title: 'Tus permisos cambiaron',
          description: 'Actualizamos tu cuenta. Revisa tu rol en Mi cuenta.',
        })
      } else {
        // Regression: a refused reading was blamed on permissions
        sileo.error({
          title: 'El servidor no aceptó el cambio',
          description:
            'Revisa que la fecha y hora del teléfono sean correctas y que los datos estén bien.',
        })
      }
    })
  return true
}
