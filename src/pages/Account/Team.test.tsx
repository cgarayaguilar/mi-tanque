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
import type { TeamMember } from 'services/team'
import { useSessionStore } from 'store/session'
import type { Role } from 'utils/roles'
import { choose } from '../../testing/choose'

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
  readTeam: vi.fn(),
  readPendingInvitations: vi.fn(),
  readOwnershipBlocks: vi.fn(() => Promise.resolve([] as string[])),
  callTeam: vi.fn(() => Promise.resolve({ ok: true })),
  createInvitation: vi.fn(() =>
    Promise.resolve({
      token: 't'.repeat(43),
      expiresAt: '2026-10-08T12:00:00.000Z',
    })
  ),
  invitationLink: (token: string) =>
    `https://solocamioneros.com/invitacion/${token}`,
}))
vi.mock('services/team', () => teamApi)

const member = (
  uid: string,
  role: Role,
  contact: Partial<TeamMember> = {}
): TeamMember => ({
  uid,
  displayName: uid.charAt(0).toUpperCase() + uid.slice(1),
  role,
  email: null,
  phoneNumber: null,
  ...contact,
})

const TEAM = [
  member('ana', 'owner', { email: 'ana@example.com' }),
  member('sam', 'supervisor', { phoneNumber: '+50588112233' }),
  member('dan', 'driver', { phoneNumber: '+50588445566' }),
  member('vera', 'viewer'),
]

const account = (role: Role): AccountData => ({
  needsContactSync: false,
  profile: { displayName: 'Ana', activeOrgId: 'org-a' },
  memberships: [{ orgId: 'org-a', role, orgName: 'Flota de Ana' }],
  organization: { id: 'org-a', name: 'Flota de Ana', defaultCurrency: 'USD' },
})

const renderAs = (uid: string, role: Role) => {
  const data = account(role)
  sessionApi.readAccount.mockResolvedValue(data)
  useSessionStore.setState({
    status: 'ready',
    user: { uid, displayName: uid, email: null, phoneNumber: null },
    ...data,
    start: () => Promise.resolve(),
  })
  window.history.pushState({}, '', '/cuenta')
  render(<App />)
}

const members = async () =>
  within(await screen.findByRole('list', { name: 'Miembros' }))

beforeEach(() => {
  teamApi.readTeam.mockResolvedValue(TEAM)
  teamApi.readPendingInvitations.mockResolvedValue([
    {
      id: 'h1',
      role: 'driver',
      createdByName: 'Ana',
      expiresAt: new Date(2026, 9, 8, 12, 0),
    },
    {
      id: 'h2',
      role: 'supervisor',
      createdByName: 'Ana',
      expiresAt: new Date(2026, 9, 9, 12, 0),
    },
  ])
})

afterEach(() => {
  vi.clearAllMocks()
})

test('everyone sees the team with role and contact (RF-8)', async () => {
  renderAs('vera', 'viewer')
  const list = await members()
  const rows = list.getAllByRole('listitem')
  expect(rows.map(row => row.textContent)).toEqual([
    'Anaana@example.comDueño',
    'Sam+50588112233Supervisor',
    'Dan+50588445566Chofer',
    'Vera (tú)Lectura',
  ])
  expect(list.getByRole('link', { name: '+50588445566' })).toHaveAttribute(
    'href',
    'tel:+50588445566'
  )
  // Lectura manages nobody and invites nobody
  expect(list.queryByRole('button', { name: /Opciones/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Crear enlace' })).toBeNull()
  expect(teamApi.readPendingInvitations).not.toHaveBeenCalled()
})

test('a supervisor manages only drivers and viewers, and invites only those (RF-1, RF-9)', async () => {
  renderAs('sam', 'supervisor')
  const list = await members()
  expect(list.queryByRole('button', { name: 'Opciones de Ana' })).toBeNull()
  expect(
    list.getByRole('button', { name: 'Opciones de Dan' })
  ).toBeInTheDocument()

  const roles = screen.getByRole('group', { name: 'Invitar como' })
  expect(
    within(roles)
      .getAllByRole('button')
      .map(option => option.textContent)
  ).toEqual(['Chofer', 'Lectura'])

  // Revokes the driver's link, not the supervisor's
  const pending = await screen.findAllByRole('button', { name: 'Revocar' })
  expect(pending).toHaveLength(1)
})

test('creating a link shows it once, to copy or share (RF-1, RF-2)', async () => {
  const writeText = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  renderAs('ana', 'owner')
  await members()
  await choose('Invitar como', 'Supervisor')
  fireEvent.click(screen.getByRole('button', { name: 'Crear enlace' }))

  const dialog = await screen.findByRole('dialog', {
    name: 'Enlace para Supervisor',
  })
  expect(teamApi.createInvitation).toHaveBeenCalledWith('org-a', 'supervisor')
  expect(dialog).toHaveTextContent(
    `https://solocamioneros.com/invitacion/${'t'.repeat(43)}`
  )
  expect(dialog).toHaveTextContent('Solo se muestra ahora')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Copiar enlace' }))
  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalledWith({ title: 'Enlace copiado' })
  })
  // The pending list reloads with the new link
  expect(teamApi.readPendingInvitations).toHaveBeenCalledTimes(2)
})

test('revoking asks first (RF-3)', async () => {
  renderAs('ana', 'owner')
  const [revoke] = await screen.findAllByRole('button', { name: 'Revocar' })
  fireEvent.click(revoke as HTMLElement)
  const confirm = screen.getByRole('dialog', {
    name: '¿Revocar esta invitación?',
  })
  fireEvent.click(within(confirm).getByRole('button', { name: 'Revocar' }))
  await waitFor(() => {
    expect(teamApi.callTeam).toHaveBeenCalledWith({
      action: 'revokeInvitation',
      orgId: 'org-a',
      invitationId: 'h1',
    })
  })
  expect(sileo.success).toHaveBeenCalledWith({
    title: 'Revocamos la invitación',
  })
})

test('promoting to owner asks for a separate confirmation (RF-9)', async () => {
  renderAs('ana', 'owner')
  const list = await members()
  fireEvent.click(list.getByRole('button', { name: 'Opciones de Sam' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Cambiar rol' }))
  const dialog = screen.getByRole('dialog', { name: 'Rol de Sam' })
  fireEvent.click(within(dialog).getByLabelText('Dueño'))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

  const confirm = screen.getByRole('dialog', { name: '¿Hacer Dueño a Sam?' })
  expect(teamApi.callTeam).not.toHaveBeenCalled()
  fireEvent.click(within(confirm).getByRole('button', { name: 'Hacer Dueño' }))
  await waitFor(() => {
    expect(teamApi.callTeam).toHaveBeenCalledWith({
      action: 'changeRole',
      orgId: 'org-a',
      uid: 'sam',
      role: 'owner',
    })
  })
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Sam ahora es Dueño' })
})

test('removing a member asks first and says what stays (RF-10)', async () => {
  renderAs('ana', 'owner')
  const list = await members()
  fireEvent.click(list.getByRole('button', { name: 'Opciones de Dan' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Sacar del equipo' }))
  const confirm = screen.getByRole('dialog', {
    name: '¿Sacar a Dan del equipo?',
  })
  expect(confirm).toHaveTextContent('Sus mediciones se conservan con su nombre')
  fireEvent.click(within(confirm).getByRole('button', { name: 'Sacar' }))
  await waitFor(() => {
    expect(teamApi.callTeam).toHaveBeenCalledWith({
      action: 'removeMember',
      orgId: 'org-a',
      uid: 'dan',
    })
  })
  expect(sileo.success).toHaveBeenCalledWith({
    title: 'Sacaste a Dan del equipo',
  })
})

test('the only owner cannot leave nor step down; anyone else can (RF-11)', async () => {
  renderAs('ana', 'owner')
  const list = await members()
  expect(list.queryByRole('button', { name: 'Opciones de Ana' })).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Salir de Flota de Ana' })
  ).toBeDisabled()
  expect(
    screen.getByText(
      'Eres el único Dueño: nombra a otro Dueño para poder salir.'
    )
  ).toBeInTheDocument()
})

test('a driver leaves after confirming and the session reloads (RF-11)', async () => {
  renderAs('dan', 'driver')
  await members()
  fireEvent.click(screen.getByRole('button', { name: 'Salir de Flota de Ana' }))
  fireEvent.click(
    within(
      screen.getByRole('dialog', { name: '¿Salir de Flota de Ana?' })
    ).getByRole('button', { name: 'Salir' })
  )
  await waitFor(() => {
    expect(teamApi.callTeam).toHaveBeenCalledWith({
      action: 'leave',
      orgId: 'org-a',
    })
  })
  await waitFor(() => {
    expect(sessionApi.readAccount).toHaveBeenCalled()
  })
  expect(sileo.success).toHaveBeenCalledWith({
    title: 'Saliste de Flota de Ana',
  })
})

test('a refused change shows why', async () => {
  teamApi.callTeam.mockRejectedValueOnce({
    code: 'functions/failed-precondition',
    details: { reason: 'last-owner' },
  })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  renderAs('ana', 'owner')
  const list = await members()
  fireEvent.click(list.getByRole('button', { name: 'Opciones de Dan' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Sacar del equipo' }))
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Sacar' })
  )
  await waitFor(() => {
    expect(sileo.error).toHaveBeenCalledWith({
      title: 'No pudimos sacarlo del equipo',
      description:
        'La organización necesita al menos un Dueño. Nombra a otro Dueño primero.',
    })
  })
})

describe('organizations and the account (RF-13, RF-14)', () => {
  test('creates another organization, which becomes the active one', async () => {
    renderAs('ana', 'owner')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Crear organización' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Nueva organización' })
    fireEvent.change(within(dialog).getByLabelText('Nombre'), {
      target: { value: 'Transportes Ana' },
    })
    await choose('Moneda', 'Quetzales guatemaltecos (Q)', dialog)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }))
    await waitFor(() => {
      expect(sessionApi.callAccount).toHaveBeenCalledWith({
        action: 'createOrganization',
        name: 'Transportes Ana',
        currency: 'GTQ',
      })
    })
    expect(sileo.success).toHaveBeenCalledWith({
      title: 'Creaste Transportes Ana',
      description: 'Es tu organización activa.',
    })
  })

  test('deleting is blocked while they are the only owner of a shared organization', async () => {
    teamApi.readOwnershipBlocks.mockResolvedValueOnce(['Flota de Ana'])
    renderAs('ana', 'owner')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Eliminar mi cuenta' })
    )
    const dialog = screen.getByRole('dialog', { name: '¿Eliminar tu cuenta?' })
    expect(
      await within(dialog).findByText(/Eres el único Dueño de Flota de Ana/)
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'Eliminar mi cuenta' })
    ).toBeNull()
  })

  test('deleting needs the word ELIMINAR, then signs out to the basic mode', async () => {
    renderAs('ana', 'owner')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Eliminar mi cuenta' })
    )
    const dialog = screen.getByRole('dialog', { name: '¿Eliminar tu cuenta?' })
    const field = await within(dialog).findByLabelText(
      'Escribe ELIMINAR para confirmar'
    )
    fireEvent.change(field, { target: { value: 'eliminar' } })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Eliminar mi cuenta' })
    )
    expect(
      await within(dialog).findByText('Escribe ELIMINAR para confirmar', {
        selector: 'p',
      })
    ).toBeInTheDocument()
    expect(sessionApi.callAccount).not.toHaveBeenCalledWith({
      action: 'deleteAccount',
    })

    fireEvent.change(field, { target: { value: 'ELIMINAR' } })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Eliminar mi cuenta' })
    )
    await waitFor(() => {
      expect(sessionApi.signOutAndClear).toHaveBeenCalled()
    })
    expect(sessionApi.callAccount).toHaveBeenCalledWith({
      action: 'deleteAccount',
    })
    expect(sileo.success).toHaveBeenCalledWith({
      title: 'Eliminamos tu cuenta',
      description: 'Los datos de este teléfono sin cuenta siguen aquí.',
    })
    expect(useSessionStore.getState().status).toBe('signedOut')
  })
})
