import type { Account, SessionUser } from 'services/session'

const api = vi.hoisted(() => ({
  subscribeToAuth: vi.fn(),
  completeRedirectSignIn: vi.fn(() => Promise.resolve()),
  readAccount: vi.fn(),
  callAccount: vi.fn(() => Promise.resolve({})),
  setActiveOrganization: vi.fn(() => Promise.resolve()),
  hasPendingWrites: vi.fn(() => Promise.resolve(false)),
  signOutAndClear: vi.fn(() => Promise.resolve()),
}))
vi.mock('services/session', () => api)

const ana: SessionUser = {
  uid: 'ana',
  displayName: 'Ana',
  email: 'ana@example.com',
  phoneNumber: null,
}

const readyAccount: Account = {
  profile: { displayName: 'Ana', activeOrgId: 'org-a' },
  memberships: [
    { orgId: 'org-a', role: 'owner', orgName: 'Flota de Ana' },
    { orgId: 'org-b', role: 'driver', orgName: 'Transportes B' },
  ],
  organization: { id: 'org-a', name: 'Flota de Ana', defaultCurrency: 'USD' },
  needsContactSync: false,
}

// The store reads the session hint when it is created: import it per test
const loadStore = async () => {
  vi.resetModules()
  const { useSessionStore } = await import('store/session')
  return useSessionStore
}

/** Starts the store and returns the auth listener it registered. */
const startWithListener = async () => {
  let listener: ((user: SessionUser | null) => void) | undefined
  api.subscribeToAuth.mockImplementation(
    (onChange: (user: SessionUser | null) => void) => {
      listener = onChange
      return Promise.resolve(() => undefined)
    }
  )
  const store = await loadStore()
  await store.getState().start()
  if (!listener) throw new Error('No auth listener')
  return { store, emit: listener }
}

const settled = () => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => {
  window.localStorage.clear()
  api.readAccount.mockResolvedValue(readyAccount)
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('without a remembered session it starts signed out and loads nothing', async () => {
  const store = await loadStore()

  expect(store.getState().status).toBe('signedOut')
  expect(api.subscribeToAuth).not.toHaveBeenCalled()
})

test('a remembered session starts loading until the account arrives', async () => {
  window.localStorage.setItem('sessionActive', 'true')
  const store = await loadStore()

  expect(store.getState().status).toBe('loading')
})

test('a signed-in user with an account is ready, with the active organization', async () => {
  const { store, emit } = await startWithListener()

  emit(ana)
  await settled()

  expect(store.getState()).toMatchObject({
    status: 'ready',
    user: ana,
    organization: { id: 'org-a', name: 'Flota de Ana' },
  })
  expect(window.localStorage.getItem('sessionActive')).toBe('true')
})

test('a first sign-in goes to onboarding (specs/0002 RF-7)', async () => {
  api.readAccount.mockResolvedValue({
    profile: null,
    memberships: [],
    organization: null,
  })
  const { store, emit } = await startWithListener()

  emit(ana)
  await settled()

  expect(store.getState().status).toBe('needsOnboarding')
})

test('completing onboarding calls bootstrap and becomes ready', async () => {
  api.readAccount.mockResolvedValueOnce({
    profile: null,
    memberships: [],
    organization: null,
  })
  const { store, emit } = await startWithListener()
  emit(ana)
  await settled()

  await store
    .getState()
    .completeOnboarding({ orgName: 'Flota de Ana', currency: 'NIO' })

  expect(api.callAccount).toHaveBeenCalledWith({
    action: 'bootstrap',
    orgName: 'Flota de Ana',
    currency: 'NIO',
  })
  expect(store.getState().status).toBe('ready')
})

test('a failed account read shows the error state and can be retried', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  api.readAccount.mockRejectedValueOnce(new Error('unavailable'))
  const { store, emit } = await startWithListener()

  emit(ana)
  await settled()
  expect(store.getState().status).toBe('error')

  await store.getState().refresh()
  expect(store.getState().status).toBe('ready')
})

test('switching organization writes the active one and reloads', async () => {
  const { store, emit } = await startWithListener()
  emit(ana)
  await settled()

  await store.getState().switchOrganization('org-b')

  expect(api.setActiveOrganization).toHaveBeenCalledWith('ana', 'org-b')
  expect(api.readAccount).toHaveBeenCalledTimes(2)
})

test('it never switches to an organization the user does not belong to', async () => {
  const { store, emit } = await startWithListener()
  emit(ana)
  await settled()

  await store.getState().switchOrganization('org-z')

  expect(api.setActiveOrganization).not.toHaveBeenCalled()
})

test('renaming the organization sends the active org id', async () => {
  const { store, emit } = await startWithListener()
  emit(ana)
  await settled()

  await store.getState().updateOrganization({ name: 'Transportes Ana' })

  expect(api.callAccount).toHaveBeenCalledWith({
    action: 'updateOrganization',
    orgId: 'org-a',
    name: 'Transportes Ana',
  })
})

describe('signing out (specs/0002 RF-14)', () => {
  test('asks first when changes are still waiting to upload', async () => {
    api.hasPendingWrites.mockResolvedValueOnce(true)
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()

    await expect(store.getState().signOut()).resolves.toBe('pendingWrites')
    expect(api.signOutAndClear).not.toHaveBeenCalled()
    expect(store.getState().status).toBe('ready')
  })

  test('clears the account data and forgets the session', async () => {
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()

    await expect(
      store.getState().signOut({ discardPending: true })
    ).resolves.toBe('signedOut')

    expect(api.signOutAndClear).toHaveBeenCalled()
    expect(store.getState()).toMatchObject({
      status: 'signedOut',
      user: null,
      organization: null,
    })
    expect(window.localStorage.getItem('sessionActive')).toBeNull()
  })

  // Regression: an invitation left undecided was offered to the next
  // account signing in on the same phone
  test('forgets an invitation left undecided', async () => {
    const { rememberInvitation, pendingInvitation } =
      await import('utils/pendingInvitation')
    rememberInvitation('token-1')
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()

    await store.getState().signOut({ discardPending: true })
    expect(pendingInvitation()).toBeNull()
  })

  test('a sign-out from another tab also returns to the basic mode', async () => {
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()

    emit(null)

    expect(store.getState().status).toBe('signedOut')
    expect(window.localStorage.getItem('sessionActive')).toBeNull()
  })
})

describe('specs/0005', () => {
  test('a profile left without organizations goes to onboarding to create one', async () => {
    api.readAccount.mockResolvedValue({
      profile: { displayName: 'Ana', activeOrgId: null },
      memberships: [],
      organization: null,
      needsContactSync: false,
    })
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()
    expect(store.getState().status).toBe('needsOnboarding')
  })

  test('an older membership without contact is synced once, in the background (RF-15)', async () => {
    api.readAccount.mockResolvedValue({
      ...readyAccount,
      needsContactSync: true,
    })
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()
    expect(store.getState().status).toBe('ready')
    expect(api.callAccount).toHaveBeenCalledWith({ action: 'syncContact' })
    expect(store.getState()).not.toHaveProperty('needsContactSync')
  })

  test('a write refused by the rules reloads the account and warns (RF-12)', async () => {
    const { sileo } = await import('sileo')
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()
    api.readAccount.mockClear()
    api.readAccount.mockResolvedValueOnce({
      ...readyAccount,
      memberships: readyAccount.memberships.map(m => ({
        ...m,
        role: 'viewer' as const,
      })),
    })
    const { recoverFromLostPermission } = await import('store/session')

    expect(recoverFromLostPermission(new Error('offline'))).toBe(false)
    expect(
      recoverFromLostPermission({ code: 'permission-denied', message: '' })
    ).toBe(true)
    await settled()
    expect(api.readAccount).toHaveBeenCalledWith('ana')
    expect(sileo.warning).toHaveBeenCalledWith({
      title: 'Tus permisos cambiaron',
      description: 'Actualizamos tu cuenta. Revisa tu rol en Mi cuenta.',
    })
    expect(store.getState().status).toBe('ready')
  })

  // Regression: a reading the rules refused for its data (the phone's clock
  // ahead, out of range) was shown as "Tus permisos cambiaron"
  test('a refusal with the same role is not blamed on permissions', async () => {
    const { sileo } = await import('sileo')
    const { emit } = await startWithListener()
    emit(ana)
    await settled()
    const { recoverFromLostPermission } = await import('store/session')

    recoverFromLostPermission({ code: 'permission-denied', message: '' })
    await settled()
    expect(sileo.warning).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Tus permisos cambiaron' })
    )
    expect(sileo.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'El servidor no aceptó el cambio' })
    )
  })

  test('creating an organization calls the callable and reloads', async () => {
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()
    api.readAccount.mockClear()
    await store
      .getState()
      .createOrganization({ name: 'Transportes Ana', currency: 'MXN' })
    expect(api.callAccount).toHaveBeenCalledWith({
      action: 'createOrganization',
      name: 'Transportes Ana',
      currency: 'MXN',
    })
    expect(api.readAccount).toHaveBeenCalled()
  })

  test('deleting the account signs out and forgets the session', async () => {
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()
    await store.getState().deleteAccount()
    expect(api.callAccount).toHaveBeenCalledWith({ action: 'deleteAccount' })
    expect(api.signOutAndClear).toHaveBeenCalled()
    expect(store.getState().status).toBe('signedOut')
    expect(window.localStorage.getItem('sessionActive')).toBeNull()
  })

  test('a failed deletion keeps the session', async () => {
    api.callAccount.mockRejectedValueOnce(new Error('must-transfer'))
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()
    await expect(store.getState().deleteAccount()).rejects.toThrow()
    expect(api.signOutAndClear).not.toHaveBeenCalled()
    expect(store.getState().status).toBe('ready')
  })
})

describe('reading the account (audit 2026-10-01 #16, #17)', () => {
  // Regression: an older read that failed after a newer one succeeded left
  // the session in error
  test('an older read that ends later does not overwrite the latest', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { store, emit } = await startWithListener()
    let failFirst: (error: Error) => void = () => undefined
    api.readAccount.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          failFirst = reject
        })
    )
    emit(ana)
    await settled()
    await store.getState().refresh()
    expect(store.getState().status).toBe('ready')

    failFirst(new Error('late'))
    await settled()
    expect(store.getState().status).toBe('ready')
  })

  // Regression: signing out in another tab left this tab's Firestore
  // terminated, and "Reintentar" could never recover
  test('a client terminated by another tab reloads the page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      reload,
    } as unknown as Location)
    api.readAccount.mockRejectedValueOnce(
      new Error('The client has already been terminated.')
    )
    const { emit } = await startWithListener()

    emit(ana)
    await settled()
    expect(reload).toHaveBeenCalled()
  })

  // Regression: a failed Google redirect started the session again, with a
  // second auth listener, and said nothing to the user
  test('a failed Google redirect is told once, with one auth listener', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { sileo } = await import('sileo')
    api.completeRedirectSignIn.mockRejectedValueOnce(new Error('redirect'))
    api.subscribeToAuth.mockClear()
    const { store } = await startWithListener()

    await store.getState().start()
    expect(api.subscribeToAuth).toHaveBeenCalledTimes(1)
    expect(sileo.error).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'No pudimos terminar de entrar con Google',
      })
    )
  })
})

describe('entering without reading Firestore (specs/0020)', () => {
  const welcome = { profile: null, memberships: [], organization: null }
  const entered = (orgId: string, orgName: string) => ({
    orgId,
    account: {
      profile: { displayName: 'Ana', activeOrgId: orgId },
      membership: { orgId, role: 'owner', orgName },
      organization: {
        id: orgId,
        name: orgName,
        defaultCurrency: 'NIO',
        distanceUnit: 'km',
      },
    },
  })

  // CA-1: on an installed iPhone app the read could hang forever
  test('"Empezar" enters with the answer, without reading the account', async () => {
    api.readAccount.mockResolvedValueOnce(welcome)
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()
    api.readAccount.mockImplementation(() => new Promise(() => undefined))
    api.callAccount.mockResolvedValueOnce(entered('org-n', 'Flota de Ana'))

    await store
      .getState()
      .completeOnboarding({ orgName: 'Flota de Ana', currency: 'NIO' })

    expect(api.readAccount).toHaveBeenCalledTimes(1)
    expect(store.getState()).toMatchObject({
      status: 'ready',
      profile: { activeOrgId: 'org-n' },
      memberships: [{ orgId: 'org-n', role: 'owner' }],
      organization: { id: 'org-n', name: 'Flota de Ana', distanceUnit: 'km' },
    })
  })

  test('a new organization joins the others, in order, and becomes active', async () => {
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()
    api.callAccount.mockResolvedValueOnce(entered('org-c', 'Carga C'))

    await store
      .getState()
      .createOrganization({ name: 'Carga C', currency: 'NIO' })

    expect(api.readAccount).toHaveBeenCalledTimes(1)
    expect(store.getState().organization?.id).toBe('org-c')
    expect(store.getState().memberships.map(m => m.orgName)).toEqual([
      'Carga C',
      'Flota de Ana',
      'Transportes B',
    ])
  })

  // CA-2: a stale cache must not send someone who entered back to Welcome
  test('a later read without the profile keeps the account and is reported', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    api.readAccount.mockResolvedValueOnce(welcome)
    const { store, emit } = await startWithListener()
    emit(ana)
    await settled()
    api.callAccount.mockResolvedValueOnce(entered('org-n', 'Flota de Ana'))
    await store
      .getState()
      .completeOnboarding({ orgName: 'Flota de Ana', currency: 'NIO' })

    api.readAccount.mockResolvedValueOnce(welcome)
    await store.getState().refresh()

    expect(store.getState()).toMatchObject({
      status: 'ready',
      organization: { id: 'org-n' },
    })
    expect(consoleError).toHaveBeenCalledWith(
      '[readAccountStale]',
      expect.anything(),
      expect.any(Error)
    )
  })
})
