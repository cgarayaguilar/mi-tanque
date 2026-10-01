import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import type { Account } from 'services/session'
import type { InvitationPreview } from 'services/team'
import { useSessionStore } from 'store/session'
import { pendingInvitation } from 'utils/pendingInvitation'

const sessionApi = vi.hoisted(() => ({
  callAccount: vi.fn(() => Promise.resolve({ ok: true })),
  warmUpAccount: vi.fn(),
  readAccount: vi.fn(),
  setActiveOrganization: vi.fn(() => Promise.resolve()),
  hasPendingWrites: vi.fn(() => Promise.resolve(false)),
  signOutAndClear: vi.fn(() => Promise.resolve()),
}))
vi.mock('services/session', () => sessionApi)

const teamApi = vi.hoisted(() => ({
  previewInvitation: vi.fn(),
  callTeam: vi.fn(() => Promise.resolve({ orgId: 'org-b' })),
}))
vi.mock('services/team', () => teamApi)

const TOKEN = 'k'.repeat(43)

const preview = (
  overrides: Partial<InvitationPreview> = {}
): InvitationPreview => ({
  orgName: 'Transportes Pérez',
  role: 'driver',
  invitedBy: 'Olga',
  expiresAt: new Date(2026, 9, 8, 12, 0).toISOString(),
  state: 'pending',
  memberOrgId: null,
  ...overrides,
})

const joined: Account = {
  needsContactSync: false,
  profile: { displayName: 'Pedro', activeOrgId: 'org-b' },
  memberships: [
    { orgId: 'org-b', role: 'driver', orgName: 'Transportes Pérez' },
  ],
  organization: {
    id: 'org-b',
    name: 'Transportes Pérez',
    defaultCurrency: 'NIO',
  },
}

const open = (token = TOKEN) => {
  window.history.pushState({}, '', `/invitacion/${token}`)
  render(<App />)
}

const signIn = (
  status: 'ready' | 'needsOnboarding',
  user: { displayName: string | null; phoneNumber: string | null }
) => {
  useSessionStore.setState({
    status,
    user: { uid: 'pedro', email: null, ...user },
    profile:
      status === 'ready'
        ? { displayName: 'Pedro', activeOrgId: 'org-a' }
        : null,
    memberships:
      status === 'ready'
        ? [{ orgId: 'org-a', role: 'owner', orgName: 'Mía' }]
        : [],
    organization:
      status === 'ready'
        ? { id: 'org-a', name: 'Mía', defaultCurrency: 'NIO' }
        : null,
    start: () => Promise.resolve(),
  })
}

beforeEach(() => {
  sessionStorage.clear()
  teamApi.previewInvitation.mockResolvedValue(preview())
  sessionApi.readAccount.mockResolvedValue(joined)
  useSessionStore.setState({
    status: 'signedOut',
    user: null,
    profile: null,
    memberships: [],
    organization: null,
    start: () => Promise.resolve(),
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

test('without a session it shows who invites, the role and asks to sign in (RF-4)', async () => {
  open()
  expect(
    await screen.findByRole('heading', {
      name: 'Te invitan a Transportes Pérez',
    })
  ).toBeInTheDocument()
  expect(screen.getByText(/Olga te invita a unirte como/)).toHaveTextContent(
    'Chofer'
  )
  expect(
    screen.getByText('Tu equipo verá tu nombre y tu teléfono o correo.')
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Entrar para unirme' }))
  expect(pendingInvitation()).toBe(TOKEN)
  expect(window.location.pathname).toBe('/entrar')
})

test('a new phone account gives only its name and joins (RF-4, RF-5)', async () => {
  signIn('needsOnboarding', { displayName: null, phoneNumber: '+50588887777' })
  open()
  expect(
    await screen.findByText('Tu equipo verá tu nombre y tu teléfono.')
  ).toBeInTheDocument()
  // No organization or currency: only the name
  expect(screen.queryByLabelText('Nombre de tu organización')).toBeNull()
  expect(screen.queryByLabelText('Moneda')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Unirme' }))
  expect(await screen.findByText('Escribe tu nombre')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('¿Cómo te llamas?'), {
    target: { value: 'Pedro' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Unirme' }))
  await waitFor(() => {
    expect(teamApi.callTeam).toHaveBeenCalledWith({
      action: 'acceptInvitation',
      token: TOKEN,
      displayName: 'Pedro',
    })
  })
  await waitFor(() => {
    expect(useSessionStore.getState().organization?.id).toBe('org-b')
  })
  expect(sileo.success).toHaveBeenCalledWith({
    title: 'Te uniste a Transportes Pérez',
  })
  expect(window.location.pathname).toBe('/')
})

test('an existing account joins with one tap, or says "Ahora no"', async () => {
  signIn('ready', { displayName: 'Pedro', phoneNumber: null })
  open()
  expect(
    await screen.findByText('Tu equipo verá tu nombre y tu correo.')
  ).toBeInTheDocument()
  expect(screen.queryByLabelText('¿Cómo te llamas?')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Unirme' }))
  await waitFor(() => {
    expect(teamApi.callTeam).toHaveBeenCalledWith({
      action: 'acceptInvitation',
      token: TOKEN,
    })
  })
})

test.each([
  ['expired', 'Este enlace venció', 'Las invitaciones duran 7 días'],
  ['accepted', 'Este enlace ya se usó', 'Cada enlace sirve para una persona'],
] as const)('a %s link explains it (RF-6)', async (state, title, text) => {
  teamApi.previewInvitation.mockResolvedValue(preview({ state }))
  open()
  expect(
    await screen.findByRole('heading', { name: title })
  ).toBeInTheDocument()
  expect(screen.getByText(new RegExp(text))).toHaveTextContent('Olga')
})

test('revoked, unknown and malformed links look the same (RF-6, RNF-4)', async () => {
  teamApi.previewInvitation.mockRejectedValue({
    code: 'functions/not-found',
    details: { reason: 'invalid-invitation' },
  })
  open()
  expect(
    await screen.findByRole('heading', { name: 'Este enlace no es válido' })
  ).toBeInTheDocument()

  teamApi.previewInvitation.mockClear()
  open('corto')
  expect(
    (
      await screen.findAllByRole('heading', {
        name: 'Este enlace no es válido',
      })
    ).length
  ).toBeGreaterThan(0)
  expect(teamApi.previewInvitation).not.toHaveBeenCalled()
})

test('a member is sent to the organization instead (RF-6)', async () => {
  signIn('ready', { displayName: 'Pedro', phoneNumber: null })
  sessionApi.readAccount.mockResolvedValue({
    ...joined,
    memberships: [
      { orgId: 'org-a', role: 'owner', orgName: 'Mía' },
      { orgId: 'org-b', role: 'driver', orgName: 'Transportes Pérez' },
    ],
  })
  useSessionStore.setState({
    memberships: [
      { orgId: 'org-a', role: 'owner', orgName: 'Mía' },
      { orgId: 'org-b', role: 'driver', orgName: 'Transportes Pérez' },
    ],
  })
  teamApi.previewInvitation.mockResolvedValue(preview({ memberOrgId: 'org-b' }))
  open()
  fireEvent.click(
    await screen.findByRole('button', { name: 'Ir a Transportes Pérez' })
  )
  await waitFor(() => {
    expect(sessionApi.setActiveOrganization).toHaveBeenCalledWith(
      'pedro',
      'org-b'
    )
  })
})

test('a link used by someone else meanwhile is explained and reloaded (RF-7)', async () => {
  signIn('ready', { displayName: 'Pedro', phoneNumber: null })
  teamApi.callTeam.mockRejectedValueOnce({
    code: 'functions/failed-precondition',
    details: { reason: 'used' },
  })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  open()
  fireEvent.click(await screen.findByRole('button', { name: 'Unirme' }))
  await waitFor(() => {
    expect(sileo.error).toHaveBeenCalledWith({
      title: 'No pudimos unirte',
      description: 'Este enlace ya se usó. Pide uno nuevo a tu equipo.',
    })
  })
  expect(teamApi.previewInvitation).toHaveBeenCalledTimes(2)
})

test('after signing in, the sign-in page returns to the invitation', async () => {
  sessionStorage.setItem('pendingInvitation', TOKEN)
  signIn('ready', { displayName: 'Pedro', phoneNumber: null })
  window.history.pushState({}, '', '/entrar')
  render(<App />)
  await waitFor(() => {
    expect(window.location.pathname).toBe(`/invitacion/${TOKEN}`)
  })
})
