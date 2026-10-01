import { create } from 'zustand'
import type { Currency } from 'schemas/account'
import type {
  Membership,
  Organization,
  Profile,
  SessionUser,
} from 'services/session'
import { reportError } from 'utils/reportError'

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

const hasHint = () => {
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
  updateProfile: (displayName: string) => Promise<void>
  updateOrganization: (changes: {
    name?: string
    defaultCurrency?: Currency
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

export const useSessionStore = create<SessionState>()((set, get) => {
  const loadAccount = async (user: SessionUser) => {
    set({ status: 'loading', user })
    try {
      const api = await sessionApi()
      const account = await api.readAccount(user.uid)
      // The user may have signed out while this was loading
      if (get().user?.uid !== user.uid) return
      set({
        ...account,
        status: account.profile ? 'ready' : 'needsOnboarding',
      })
    } catch (error) {
      reportError(error, { operation: 'readAccount' })
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
          await api.subscribeToAuth(user => {
            setHint(user !== null)
            if (user) void loadAccount(user)
            else set(EMPTY)
          })
          await api.completeRedirectSignIn()
        } catch (error) {
          started = null
          reportError(error, { operation: 'startSession' })
          set({ status: hasHint() ? 'error' : 'signedOut' })
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
      set(EMPTY)
      return 'signedOut'
    },
  }
})

/** The caller's role in the active organization. */
export const selectActiveRole = (state: SessionState) =>
  state.memberships.find(m => m.orgId === state.organization?.id)?.role ?? null
