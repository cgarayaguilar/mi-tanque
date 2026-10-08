import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import { importOfferKey } from 'hooks/useImportLocalData'
import { db } from 'services/db'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import type { Role } from 'utils/roles'
import { accountWithRole, ORG_ID } from '../../testing/fleetFixtures'

const importApi = vi.hoisted(() => ({
  importLocalData: vi.fn(() =>
    Promise.resolve({ measurements: 2, refuels: 0, skipped: 0 })
  ),
}))
vi.mock('services/importLocal', () => importApi)

// Mi cuenta → Equipo reads the team (specs/0005); not under test here
vi.mock('services/team', () => ({
  readTeam: vi.fn(() => Promise.resolve([])),
  readPendingInvitations: vi.fn(() => Promise.resolve([])),
  readOwnershipBlocks: vi.fn(() => Promise.resolve([])),
  callTeam: vi.fn(() => Promise.resolve({ ok: true })),
}))

const fleetApi = vi.hoisted(() => ({
  readFleet: vi.fn(() =>
    Promise.resolve({ trucks: [], trailers: [], tanks: [], clients: [] })
  ),
  readMembers: vi.fn(() => Promise.resolve([])),
}))
vi.mock('services/fleet', () => fleetApi)

const signIn = (role: Role = 'owner') => {
  useSessionStore.setState({
    status: 'ready',
    user: { uid: 'luis', displayName: 'Luis', email: null, phoneNumber: null },
    ...accountWithRole(role),
    start: () => Promise.resolve(),
  })
}

const localMeasurement = (intentId: string) => ({
  date: new Date(2026, 5, 2),
  location: 'Managua, Nicaragua',
  tankId: 1,
  intentId,
  inches: 12,
  gallons: '38.85',
  liters: '147.06',
  fuelHeight: '48.00',
})

const renderAccount = () => {
  window.history.pushState({}, '', '/cuenta')
  render(<App />)
}

beforeEach(async () => {
  window.localStorage.clear()
  useFleetStore.getState().reset()
  await db.measurements.clear()
  await db.tanks.clear()
  await db.measurements.bulkAdd([localMeasurement('a'), localMeasurement('b')])
  signIn()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

const offer = () =>
  screen.findByRole('dialog', {
    name: '¿Pasamos tus datos a Flota de Luis?',
  })

test('with local measurements, signing in offers to import them (CA-8)', async () => {
  renderAccount()
  expect(await offer()).toHaveTextContent('Este teléfono tiene 2 mediciones')

  fireEvent.click(screen.getByRole('button', { name: 'Importar' }))
  await waitFor(() => {
    expect(importApi.importLocalData).toHaveBeenCalledWith({
      orgId: ORG_ID,
      uid: 'luis',
      userName: 'Luis',
    })
  })
  expect(sileo.success).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Importamos 2 mediciones' })
  )
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  expect(window.localStorage.getItem(importOfferKey(ORG_ID))).toBe('done')
})

test('"Ahora no" does not ask again in that organization (CA-8)', async () => {
  const { unmount } = render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Ahora no' }))
  expect(window.localStorage.getItem(importOfferKey(ORG_ID))).toBe('dismissed')
  unmount()

  renderAccount()
  expect(
    await screen.findByRole('heading', { name: 'Datos de este teléfono' })
  ).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('Mi cuenta imports later too, and repeating says it was all there (CA-8)', async () => {
  window.localStorage.setItem(importOfferKey(ORG_ID), 'dismissed')
  importApi.importLocalData.mockResolvedValueOnce({
    measurements: 0,
    refuels: 0,
    skipped: 1,
  })
  renderAccount()

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Importar datos de este teléfono',
    })
  )
  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalledWith({
      title: 'Ya estaba todo importado',
      description:
        '1 registro no se pudo pasar porque sus datos están fuera de rango.',
    })
  })
})

test('offline, it asks for a connection instead of starting', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  renderAccount()
  fireEvent.click(await screen.findByRole('button', { name: 'Importar' }))
  expect(sileo.warning).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Necesitas conexión para importar' })
  )
  expect(importApi.importLocalData).not.toHaveBeenCalled()
})

test('a failed import is reported and can be retried', async () => {
  importApi.importLocalData.mockRejectedValueOnce(new Error('unavailable'))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  renderAccount()
  fireEvent.click(await screen.findByRole('button', { name: 'Importar' }))
  await waitFor(() => {
    expect(sileo.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No pudimos importar tus datos' })
    )
  })
  expect(await offer()).toBeInTheDocument()
  expect(window.localStorage.getItem(importOfferKey(ORG_ID))).toBeNull()
})

test('Lectura is not offered to import, nor sees it in Mi cuenta', async () => {
  signIn('viewer')
  renderAccount()
  expect(
    await screen.findByRole('heading', { name: 'Organización' })
  ).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Importar datos de este teléfono' })
  ).toBeNull()
})

test('without local measurements there is nothing to offer', async () => {
  await db.measurements.clear()
  renderAccount()
  expect(
    await screen.findByRole('heading', { name: 'Datos de este teléfono' })
  ).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).toBeNull()
})
