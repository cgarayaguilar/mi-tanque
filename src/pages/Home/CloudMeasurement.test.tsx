import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import { gallonsAt } from 'utils/tankVolume'
import type { Role } from 'utils/roles'
import {
  accountWithRole,
  ORG_ID,
  tank,
  trailer,
  truck,
} from '../../testing/fleetFixtures'
import { choose } from '../../testing/choose'

const fleetApi = vi.hoisted(() => ({
  readFleet: vi.fn(),
  readMembers: vi.fn(() => Promise.resolve([])),
}))
vi.mock('services/fleet', () => fleetApi)

const measurementsApi = vi.hoisted(() => ({
  createCloudMeasurement: vi.fn(() => Promise.resolve()),
  addMeasurementLocation: vi.fn(() => Promise.resolve()),
}))
vi.mock('services/cloudMeasurements', () => measurementsApi)

// Reloading the account after a refused write (specs/0005 RF-12)
const sessionApi = vi.hoisted(() => ({ readAccount: vi.fn() }))
vi.mock('services/session', () => sessionApi)

const signIn = (role: Role = 'driver') => {
  useSessionStore.setState({
    status: 'ready',
    user: { uid: 'luis', displayName: 'Luis', email: null, phoneNumber: null },
    ...accountWithRole(role),
    start: () => Promise.resolve(),
  })
}

const mockGeolocation = (coords?: {
  latitude: number
  longitude: number
  accuracy: number
}) => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (
        success: (position: { coords: typeof coords }) => void,
        error: (reason: { code: number; message: string }) => void
      ) =>
        setTimeout(() => {
          if (coords) success({ coords })
          else error({ code: 1, message: 'User denied Geolocation' })
        }, 10),
    },
  })
}

const LEFT = tank()
const RIGHT = tank({
  id: 'tank-2',
  name: 'Tanque derecho',
  shape: 'cylinder',
  dimensions: { diameterIn: 26, lengthIn: 48 },
  capacityGal: 100,
})
const REEFER = tank({
  id: 'tank-3',
  name: 'Tanque del termo',
  shape: 'rectangular',
  dimensions: { heightIn: 20, widthIn: 24, lengthIn: 30 },
  capacityGal: 50,
  equipment: { kind: 'trailer', id: 'trailer-1' },
})
const LOOSE = tank({
  id: 'tank-4',
  name: 'Tanque de reserva',
  shape: 'cylinder',
  dimensions: { diameterIn: 25, lengthIn: 26 },
  capacityGal: 50,
  equipment: { kind: 'none', id: null },
})

const renderHome = () => {
  window.history.pushState({}, '', '/')
  render(<App />)
}

const measure = (inches: string) => {
  fireEvent.change(screen.getByLabelText('Pulgadas de combustible'), {
    target: { value: inches },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Calcular' }))
}

beforeEach(() => {
  window.localStorage.clear()
  useFleetStore.getState().reset()
  fleetApi.readFleet.mockResolvedValue({
    trucks: [truck()],
    trailers: [trailer()],
    tanks: [LEFT, RIGHT, REEFER, LOOSE],
  })
  mockGeolocation()
  signIn()
})

afterEach(() => {
  vi.clearAllMocks()
  Reflect.deleteProperty(navigator, 'geolocation')
})

test('a truck with two tanks asks for the truck, then the tank (CA-1)', async () => {
  renderHome()

  fireEvent.mouseDown(await screen.findByLabelText('Equipo'))
  expect(
    (await screen.findAllByRole('option')).map(option => option.textContent)
  ).toEqual(['Camión · Unidad 12', 'Remolque · Caja 7', 'Tanques individuales'])
  fireEvent.keyDown(screen.getByLabelText('Equipo'), { key: 'Escape' })
  expect(screen.getByLabelText('Tanque')).toHaveValue('')
  expect(screen.queryByLabelText('Pulgadas de combustible')).toBeNull()

  await choose('Tanque', 'Tanque izquierdo')
  expect(screen.getByLabelText('Pulgadas de combustible')).toBeInTheDocument()
})

test('a trailer with a single tank picks it by itself (CA-1)', async () => {
  renderHome()
  await choose('Equipo', 'Remolque · Caja 7')
  expect(screen.queryByLabelText('Tanque')).toBeNull()
  expect(screen.getByText('Tanque del termo')).toBeInTheDocument()
})

test('the inches field rejects more than the tank height (CA-1)', async () => {
  renderHome()
  await choose('Tanque', 'Tanque izquierdo')
  measure('25')
  expect(
    await screen.findByText('Este tanque permite hasta 24 pulgadas.')
  ).toBeInTheDocument()
  expect(measurementsApi.createCloudMeasurement).not.toHaveBeenCalled()
})

test('a "D" tank at 12 inches shows its gallons and the truck range, and saves at once (CA-2, CA-3)', async () => {
  mockGeolocation({ latitude: 12.13, longitude: -86.25, accuracy: 9.6 })
  renderHome()
  await choose('Tanque', 'Tanque izquierdo')
  fireEvent.change(screen.getByLabelText('Odómetro (opcional)'), {
    target: { value: '120600' },
  })
  measure('12')

  const gallons = gallonsAt(
    {
      shape: 'd_flat_side',
      orientation: 'horizontal',
      dimensions: { heightIn: 24, widthIn: 30, lengthIn: 48 },
    },
    12
  )
  const km = Math.round(gallons * 9.5)
  expect(
    await screen.findByText(
      `Alcanza para unos ${String(km).replace(/\B(?=(\d{3})+(?!\d))/g, '')} km`,
      { exact: false }
    )
  ).toBeInTheDocument()

  expect(measurementsApi.createCloudMeasurement).toHaveBeenCalledWith(
    expect.objectContaining({
      orgId: ORG_ID,
      tankId: 'tank-1',
      tankName: 'Tanque izquierdo',
      equipment: { kind: 'truck', id: 'truck-1', name: 'Unidad 12' },
      userId: 'luis',
      userName: 'Luis',
      odometerKm: 120600,
      reading: expect.objectContaining({
        inches: 12,
        gallons: Math.round(gallons * 100) / 100,
        estimate: expect.objectContaining({ kmPerGal: 9.5 }) as unknown,
      }) as unknown,
    })
  )
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Medición guardada' })

  // The location arrives later, as one update of the same document (RF-4)
  const [[saved]] = measurementsApi.createCloudMeasurement.mock
    .calls as unknown as [[{ id: string }]]
  await waitFor(() => {
    expect(measurementsApi.addMeasurementLocation).toHaveBeenCalledWith(
      saved.id,
      'luis',
      { latitude: 12.13, longitude: -86.25, accuracy: 9.6 }
    )
  })
})

test('each save is a new intent; a reefer tank uses the hitched truck (CA-2)', async () => {
  renderHome()
  await choose('Equipo', 'Remolque · Caja 7')
  measure('10')
  await waitFor(() => {
    expect(measurementsApi.createCloudMeasurement).toHaveBeenCalledTimes(1)
  })
  measure('11')
  await waitFor(() => {
    expect(measurementsApi.createCloudMeasurement).toHaveBeenCalledTimes(2)
  })

  const calls = measurementsApi.createCloudMeasurement.mock
    .calls as unknown as [{ id: string; reading: { estimate: unknown } }][]
  expect(calls).toHaveLength(2)
  expect(calls[0]?.[0].id).not.toBe(calls[1]?.[0].id)
  expect(calls[0]?.[0].reading.estimate).toEqual(
    expect.objectContaining({ kmPerGal: 9.5 })
  )
  // Not a truck tank: no odometer asked
  expect(screen.queryByLabelText('Odómetro (opcional)')).toBeNull()
})

// Regression: the first save is not awaited, so a quick second tap on
// "Calcular" saved the same measurement twice (ADR 0003)
test('a double tap saves one measurement', async () => {
  renderHome()
  await choose('Equipo', 'Remolque · Caja 7')
  measure('10')
  await waitFor(() => {
    expect(measurementsApi.createCloudMeasurement).toHaveBeenCalledTimes(1)
  })
  fireEvent.click(screen.getByRole('button', { name: 'Calcular' }))
  await new Promise(resolve => setTimeout(resolve, 50))

  expect(measurementsApi.createCloudMeasurement).toHaveBeenCalledTimes(1)
})

test('an individual tank has no estimate', async () => {
  renderHome()
  await choose('Equipo', 'Tanques individuales')
  measure('10')
  expect(
    await screen.findByText(
      'Este tanque no es de un camión: no hay estimación de distancia.'
    )
  ).toBeInTheDocument()
  expect(measurementsApi.createCloudMeasurement).toHaveBeenCalledWith(
    expect.objectContaining({
      equipment: { kind: 'none', id: null, name: null },
      reading: expect.objectContaining({ estimate: null }) as unknown,
    })
  )
})

test('the last tank measured is chosen next time', async () => {
  const { unmount } = render(<App />)
  await choose('Tanque', 'Tanque derecho')
  measure('10')
  unmount()

  renderHome()
  expect(await screen.findByLabelText('Tanque')).toHaveValue('Tanque derecho')
})

test('a rejected save is reported', async () => {
  measurementsApi.createCloudMeasurement.mockRejectedValueOnce(
    new Error('permission-denied')
  )
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  renderHome()
  await choose('Equipo', 'Tanques individuales')
  measure('10')
  await waitFor(() => {
    expect(sileo.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No pudimos guardar la medición' })
    )
  })
})

test('Lectura calculates without saving', async () => {
  signIn('viewer')
  renderHome()
  await choose('Equipo', 'Tanques individuales')
  expect(
    screen.getByText(
      'Con tu rol de Lectura puedes calcular, pero no se guarda la medición.'
    )
  ).toBeInTheDocument()
  measure('10')
  expect(await screen.findByRole('status')).toBeInTheDocument()
  expect(measurementsApi.createCloudMeasurement).not.toHaveBeenCalled()
})

test('without tanks it invites to add one', async () => {
  fleetApi.readFleet.mockResolvedValue({ trucks: [], trailers: [], tanks: [] })
  renderHome()
  expect(
    await screen.findByText('Agrega tus tanques para medir')
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Agregar tanque' })
  ).toBeInTheDocument()
})

test('a save refused because the role changed reloads the account instead of blaming the data (specs/0005 RF-12)', async () => {
  measurementsApi.createCloudMeasurement.mockRejectedValueOnce({
    code: 'permission-denied',
  })
  sessionApi.readAccount.mockResolvedValue({
    ...accountWithRole('viewer'),
    needsContactSync: false,
  })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  renderHome()
  await choose('Equipo', 'Tanques individuales')
  measure('10')
  await waitFor(() => {
    expect(sileo.warning).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Tus permisos cambiaron' })
    )
  })
  expect(sileo.error).not.toHaveBeenCalled()
  await waitFor(() => {
    expect(sessionApi.readAccount).toHaveBeenCalledWith('luis')
  })
})
