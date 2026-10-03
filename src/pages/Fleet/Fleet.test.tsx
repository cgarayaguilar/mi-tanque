import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { addDays } from 'date-fns'
import App from '../../App'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import { toPlainDate } from 'utils/plainDate'
import type { Role } from 'utils/roles'
import {
  accountWithRole,
  tank,
  trailer,
  truck,
} from '../../testing/fleetFixtures'

const api = vi.hoisted(() => ({
  readFleet: vi.fn(),
  readMembers: vi.fn(() => Promise.resolve([])),
  updateFleetItem: vi.fn(() => Promise.resolve()),
  newFleetId: vi.fn(() => 'new-id'),
}))
vi.mock('services/fleet', () => api)

const signIn = (role: Role = 'owner') => {
  useSessionStore.setState({
    status: 'ready',
    user: {
      uid: 'luis',
      displayName: 'Luis',
      email: null,
      phoneNumber: '+50588112233',
    },
    ...accountWithRole(role),
    start: () => Promise.resolve(),
  })
}

const renderAt = (path: string) => {
  window.history.pushState({}, '', path)
  render(<App />)
}

beforeEach(() => {
  useFleetStore.getState().reset()
  api.readFleet.mockResolvedValue({
    trucks: [
      truck(),
      truck({ id: 'truck-2', name: 'Unidad 15', plate: 'X 999', color: null }),
    ],
    trailers: [trailer()],
    tanks: [tank()],
  })
  signIn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('the bottom navigation shows Flota only with a session (CA-1)', async () => {
  renderAt('/flota')
  expect(await screen.findByRole('link', { name: 'Flota' })).toHaveAttribute(
    'aria-current',
    'page'
  )
})

test('trucks show their plate, figures and tanks', async () => {
  renderAt('/flota')

  const card = await screen.findByRole('button', { name: 'Camión Unidad 12' })
  expect(card).toHaveTextContent('Freightliner Cascadia 2019 · M 123-456')
  expect(card).toHaveTextContent('1 tanque · 9.5 km/gal · 120,000 km')
})

test('trailers show the truck they are hitched to; tanks their shape and equipment', async () => {
  renderAt('/flota/remolques')
  expect(
    await screen.findByRole('button', { name: 'Remolque Caja 7' })
  ).toHaveTextContent('Enganchado a Unidad 12')

  fireEvent.click(screen.getByRole('tab', { name: 'Tanques' }))
  expect(
    await screen.findByRole('button', { name: 'Tanque Tanque izquierdo' })
  ).toHaveTextContent(
    'En "D" lado plano · 24 × 30 × 48 pulg.135 gal · Unidad 12'
  )
})

test('search filters by name or plate and offers to clear', async () => {
  renderAt('/flota')
  await screen.findByRole('button', { name: 'Camión Unidad 12' })

  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar camiones' }), {
    target: { value: 'x 99' },
  })

  await waitFor(() => {
    expect(
      screen.queryByRole('button', { name: 'Camión Unidad 12' })
    ).toBeNull()
  })
  expect(
    screen.getByRole('button', { name: 'Camión Unidad 15' })
  ).toBeInTheDocument()

  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar camiones' }), {
    target: { value: 'nada' },
  })
  fireEvent.click(
    await screen.findByRole('button', { name: 'Limpiar búsqueda' })
  )
  expect(
    await screen.findByRole('button', { name: 'Camión Unidad 12' })
  ).toBeInTheDocument()
})

test('an empty section invites to add the first one', async () => {
  api.readFleet.mockResolvedValue({ trucks: [], trailers: [], tanks: [] })
  renderAt('/flota')

  fireEvent.click(await screen.findByRole('button', { name: 'Agregar camión' }))

  expect(window.location.pathname).toBe('/flota/camiones/nuevo')
})

test('when everything is archived it says so and shows them (CA-6)', async () => {
  api.readFleet.mockResolvedValue({
    trucks: [truck({ archived: true })],
    trailers: [],
    tanks: [],
  })
  renderAt('/flota')

  fireEvent.click(await screen.findByRole('button', { name: 'Ver archivados' }))

  const card = await screen.findByRole('button', { name: 'Camión Unidad 12' })
  expect(within(card).getByText('Archivado')).toBeInTheDocument()
})

test('a failed load can be retried', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  api.readFleet.mockRejectedValueOnce(new Error('unavailable'))
  renderAt('/flota')

  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))

  expect(
    await screen.findByRole('button', { name: 'Camión Unidad 12' })
  ).toBeInTheDocument()
})

test('a viewer sees the fleet without "Agregar" (CA-9)', async () => {
  signIn('viewer')
  renderAt('/flota')

  await screen.findByRole('button', { name: 'Camión Unidad 12' })
  expect(screen.queryByRole('button', { name: 'Agregar' })).toBeNull()
})

test('a tank card shows its last measurement (specs/0004 RF-18)', async () => {
  api.readFleet.mockResolvedValue({
    trucks: [truck()],
    trailers: [],
    tanks: [
      tank({
        lastMeasurement: {
          id: 'm-1',
          takenAt: new Date(Date.now() - 2 * 3_600_000 - 60_000),
          gallons: 84.4,
          fillPercent: 69.6,
        },
      }),
    ],
  })
  renderAt('/flota/tanques')
  expect(
    await screen.findByRole('button', { name: 'Tanque Tanque izquierdo' })
  ).toHaveTextContent('70 % · 84 gal · hace 2 h')
})

// specs/0011 CA-4: the insurance notice on the cards
test('trucks and trailers say when their insurance is due, not when archived', async () => {
  const inFiveDays = toPlainDate(addDays(new Date(), 5))
  api.readFleet.mockResolvedValue({
    trucks: [
      truck({ id: 't1', name: 'Unidad 1', insuranceExpiresOn: inFiveDays }),
      truck({
        id: 't2',
        name: 'Unidad 2',
        insuranceExpiresOn: '2020-01-01',
        archived: true,
      }),
    ],
    trailers: [trailer({ insuranceExpiresOn: '2020-01-01' })],
    tanks: [],
  })
  renderAt('/flota')

  expect(
    await screen.findByRole('button', {
      name: 'Camión Unidad 1, Seguro vence en 5 días',
    })
  ).toBeInTheDocument()
  expect(screen.queryByText('Seguro vencido')).toBeNull()

  fireEvent.click(screen.getByRole('tab', { name: 'Remolques' }))
  expect(await screen.findByText('Seguro vencido')).toBeInTheDocument()
})

// backend specs/0016 CA-5: trucks by brand and model, typed names recognized
test('trucks filter by brand, then model', async () => {
  api.readFleet.mockResolvedValue({
    trucks: [
      truck(),
      truck({
        id: 'truck-2',
        name: 'Unidad 15',
        brand: 'freightliner',
        model: 'Columbia',
      }),
      truck({ id: 'truck-3', name: 'Unidad 16', brand: 'Volvo', model: 'VNL' }),
    ],
    trailers: [],
    tanks: [],
  })
  renderAt('/flota/camiones')
  await screen.findByText('Unidad 16')

  const brands = screen.getByRole('group', { name: 'Marca' })
  fireEvent.click(within(brands).getByRole('button', { name: 'Freightliner' }))
  expect(screen.queryByText('Unidad 16')).toBeNull()
  expect(screen.getByText('Unidad 12')).toBeInTheDocument()
  expect(screen.getByText('Unidad 15')).toBeInTheDocument()

  const models = screen.getByRole('group', { name: 'Modelo' })
  fireEvent.click(within(models).getByRole('button', { name: 'Cascadia' }))
  expect(screen.queryByText('Unidad 15')).toBeNull()
  expect(screen.getByText('Unidad 12')).toBeInTheDocument()
})
