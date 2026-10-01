import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import type { Account as AccountData } from 'services/session'
import { useSessionStore } from 'store/session'
import type { Role } from 'utils/roles'

const api = vi.hoisted(() => ({
  callAccount: vi.fn(() => Promise.resolve({ ok: true })),
  warmUpAccount: vi.fn(),
  readAccount: vi.fn(),
  setActiveOrganization: vi.fn(() => Promise.resolve()),
  hasPendingWrites: vi.fn(() => Promise.resolve(false)),
  signOutAndClear: vi.fn(() => Promise.resolve()),
}))
vi.mock('services/session', () => api)

// Mi cuenta → Equipo reads the team (specs/0005); not under test here
vi.mock('services/team', () => ({
  readTeam: vi.fn(() => Promise.resolve([])),
  readPendingInvitations: vi.fn(() => Promise.resolve([])),
  readOwnershipBlocks: vi.fn(() => Promise.resolve([])),
  callTeam: vi.fn(() => Promise.resolve({ ok: true })),
}))

const account = (role: Role, extraOrgs = 0): AccountData => ({
  needsContactSync: false,
  profile: { displayName: 'Ana', activeOrgId: 'org-a' },
  memberships: [
    { orgId: 'org-a', role, orgName: 'Flota de Ana' },
    ...Array.from({ length: extraOrgs }, (_, i) => ({
      orgId: `org-${String(i)}`,
      role: 'driver' as const,
      orgName: `Otra ${String(i)}`,
    })),
  ],
  organization: { id: 'org-a', name: 'Flota de Ana', defaultCurrency: 'USD' },
})

const renderAccount = (data: AccountData) => {
  api.readAccount.mockResolvedValue(data)
  useSessionStore.setState({
    status: 'ready',
    user: {
      uid: 'ana',
      displayName: 'Ana',
      email: 'ana@example.com',
      phoneNumber: null,
    },
    ...data,
    start: () => Promise.resolve(),
  })
  window.history.pushState({}, '', '/cuenta')
  render(<App />)
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('the owner renames the organization (specs/0002 CA-6)', async () => {
  renderAccount(account('owner'))

  fireEvent.change(await screen.findByLabelText('Nombre de la organización'), {
    target: { value: 'Transportes Ana' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

  await waitFor(() => {
    expect(api.callAccount).toHaveBeenCalledWith({
      action: 'updateOrganization',
      orgId: 'org-a',
      name: 'Transportes Ana',
    })
  })
  expect(sileo.success).toHaveBeenCalledWith({
    title: 'Guardamos los cambios de la organización',
  })
})

test.each<Role>(['supervisor', 'driver', 'viewer'])(
  'a %s sees the organization without editing it',
  async role => {
    renderAccount(account(role))

    const section = await screen.findByRole('region', { name: 'Organización' })
    expect(within(section).getByText('Flota de Ana')).toBeInTheDocument()
    expect(within(section).queryByRole('textbox')).toBeNull()
  }
)

test('changing the name saves it', async () => {
  renderAccount(account('owner'))

  fireEvent.change(await screen.findByLabelText('Tu nombre'), {
    target: { value: 'Ana María' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))

  await waitFor(() => {
    expect(api.callAccount).toHaveBeenCalledWith({
      action: 'updateProfile',
      displayName: 'Ana María',
    })
  })
})

test('the organization selector appears only with several memberships (CA-5)', async () => {
  renderAccount(account('owner', 1))

  fireEvent.change(await screen.findByLabelText('Organización activa'), {
    target: { value: 'org-0' },
  })

  await waitFor(() => {
    expect(api.setActiveOrganization).toHaveBeenCalledWith('ana', 'org-0')
  })
})

test('with one organization there is no selector', async () => {
  renderAccount(account('owner'))

  await screen.findByText('Mi cuenta')
  expect(screen.queryByLabelText('Organización activa')).toBeNull()
})

test('signing out with changes pending asks first (CA-7)', async () => {
  api.hasPendingWrites.mockResolvedValueOnce(true)
  renderAccount(account('owner'))

  fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))

  const dialog = await screen.findByRole('dialog', {
    name: 'Tienes cambios sin subir',
  })
  expect(api.signOutAndClear).not.toHaveBeenCalled()

  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Cerrar sesión igual' })
  )

  await waitFor(() => {
    expect(api.signOutAndClear).toHaveBeenCalled()
  })
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Cerraste sesión' })
  await waitFor(() => {
    expect(window.location.pathname).toBe('/')
  })
  expect(useSessionStore.getState().status).toBe('signedOut')
})

test('the app bar shows the account menu with a session (RF-6)', async () => {
  renderAccount(account('owner'))

  fireEvent.click(await screen.findByRole('button', { name: 'Tu cuenta: Ana' }))

  expect(
    await screen.findByRole('menuitem', { name: 'Mi cuenta' })
  ).toBeInTheDocument()
  expect(
    screen.getByRole('menuitem', { name: 'Cerrar sesión' })
  ).toBeInTheDocument()
})
