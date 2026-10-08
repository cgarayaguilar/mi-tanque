import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import type { CloudRefuel } from 'services/cloudRefuels'
import { useCloudHistoryStore } from 'store/cloudHistory'
import { useCloudRefuelsStore } from 'store/cloudRefuels'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
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
  HISTORY_PAGE_SIZE: 100,
  readHistoryPage: vi.fn(() => Promise.resolve({ items: [], cursor: null })),
}))
vi.mock('services/cloudMeasurements', () => measurementsApi)

const refuelsApi = vi.hoisted(() => ({
  readRefuelsPage: vi.fn(),
  updateCloudRefuel: vi.fn(() => Promise.resolve()),
  deleteCloudRefuel: vi.fn(() => Promise.resolve()),
  invoiceUrl: vi.fn(() => Promise.resolve('https://example.com/factura.jpg')),
  readStations: vi.fn(() => Promise.resolve([])),
}))
vi.mock('services/cloudRefuels', () => refuelsApi)

const DAY = 24 * 60 * 60 * 1000

const refuel = (overrides: Partial<CloudRefuel> = {}): CloudRefuel => ({
  id: 'r1',
  orgId: ORG_ID,
  tankId: 'tank-1',
  tankName: 'Tanque izquierdo',
  equipment: { kind: 'truck', id: 'truck-1', name: 'Unidad 12' },
  userId: 'luis',
  userName: 'Luis',
  takenAt: new Date(Date.now() - DAY),
  createdAt: new Date(),
  location: null,
  place: null,
  placeStatus: null,
  gallonsAdded: 110,
  litersAdded: 416.4,
  quantityUnit: 'gallon',
  currency: 'NIO',
  priceUnit: 'gallon',
  pricePerGallon: 110,
  pricePerLiter: 29.06,
  total: 12100,
  inchesBefore: null,
  inchesAfter: null,
  gallonsBefore: 30,
  gallonsAfter: 140,
  fillPercentBefore: 20,
  fillPercentAfter: 95,
  truckGallonsBefore: 60,
  truckGallonsAfter: 170,
  stationName: 'Puma Km 7',
  invoicePhotoPath: null,
  odometerKm: 101000,
  source: 'app',
  ...overrides,
})

const signIn = (role: Role = 'owner') => {
  useSessionStore.setState({
    status: 'ready',
    user: { uid: 'luis', displayName: 'Luis', email: null, phoneNumber: null },
    ...accountWithRole(role),
    start: () => Promise.resolve(),
  })
}

const openRefuels = async () => {
  window.history.pushState({}, '', '/history')
  render(<App />)
  fireEvent.click(await screen.findByRole('tab', { name: 'Rellenos' }))
}

beforeEach(() => {
  useFleetStore.getState().reset()
  useCloudHistoryStore.getState().reset()
  useCloudRefuelsStore.getState().reset()
  fleetApi.readFleet.mockResolvedValue({
    clients: [],
    trucks: [truck()],
    trailers: [trailer()],
    tanks: [tank()],
  })
  refuelsApi.readRefuelsPage.mockResolvedValue({
    items: [
      refuel(),
      refuel({
        id: 'r0',
        takenAt: new Date(Date.now() - 3 * DAY),
        odometerKm: 100000,
        truckGallonsBefore: 30,
        truckGallonsAfter: 180,
        gallonsAdded: 150,
        total: 16500,
      }),
    ],
    cursor: null,
  })
  signIn()
})

afterEach(() => {
  vi.clearAllMocks()
})

test('the summary shows money per currency and the truck efficiency by levels (CA-4)', async () => {
  await openRefuels()
  const summary = await screen.findByRole('region', {
    name: 'Resumen del periodo',
  })
  expect(summary).toHaveTextContent('Gastado en NIOC$28,600.00 NIO')
  // 1 000 km with 180 − 60 = 120 gal
  expect(summary).toHaveTextContent('Unidad 12: 8.3 km/gal (1,000 km, 120 gal)')
  // Next to what the truck declares (backend specs/0021 CA-6)
  expect(summary).toHaveTextContent('declarado: 9.5 km/gal cargado')
  expect(refuelsApi.readRefuelsPage).toHaveBeenCalledWith(
    expect.objectContaining({ orgId: ORG_ID, equipmentId: null, after: null })
  )
})

test('the equipment filter applies to refuels too (RF-7)', async () => {
  await openRefuels()
  await screen.findByRole('region', { name: 'Resumen del periodo' })
  await choose('Equipo', 'Camión · Unidad 12')
  await waitFor(() => {
    expect(refuelsApi.readRefuelsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ equipmentId: 'truck-1' })
    )
  })
})

test('editing keeps the other tanks in the truck totals (RF-9, RF-11)', async () => {
  await openRefuels()
  const [options] = await screen.findAllByRole('button', {
    name: /Opciones del relleno/,
  })
  fireEvent.click(options as HTMLElement)
  fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))
  const dialog = screen.getByRole('dialog', { name: 'Corregir relleno' })
  fireEvent.change(within(dialog).getByLabelText('Cantidad echada'), {
    target: { value: '100' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

  await waitFor(() => {
    expect(refuelsApi.updateCloudRefuel).toHaveBeenCalled()
  })
  expect(refuelsApi.updateCloudRefuel).toHaveBeenCalledWith(
    'r1',
    'luis',
    expect.objectContaining({
      values: expect.objectContaining({
        gallonsAdded: 100,
        gallonsBefore: 30,
        gallonsAfter: 130,
      }) as unknown,
      // The other tanks held 60 − 30 = 30 gal
      totals: { truckGallonsBefore: 60, truckGallonsAfter: 160 },
      odometerKm: 101000,
    })
  )
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Relleno corregido' })
})

test('a driver changes their refuels for 24 hours; Lectura never (RF-11)', async () => {
  signIn('driver')
  refuelsApi.readRefuelsPage.mockResolvedValue({
    items: [
      refuel({ id: 'new' }),
      refuel({
        id: 'old',
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      }),
      refuel({ id: 'theirs', userId: 'ana' }),
    ],
    cursor: null,
  })
  await openRefuels()
  expect(
    await screen.findAllByRole('button', { name: /Opciones del relleno/ })
  ).toHaveLength(1)
})

test('deleting asks first (RF-11)', async () => {
  await openRefuels()
  const [options] = await screen.findAllByRole('button', {
    name: /Opciones del relleno/,
  })
  fireEvent.click(options as HTMLElement)
  fireEvent.click(screen.getByRole('menuitem', { name: 'Borrar' }))
  fireEvent.click(
    within(
      screen.getByRole('dialog', { name: '¿Borrar este relleno?' })
    ).getByRole('button', {
      name: 'Borrar',
    })
  )
  expect(refuelsApi.deleteCloudRefuel).toHaveBeenCalledWith('r1')
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Relleno borrado' })
})

test('the invoice opens from the row (RF-6)', async () => {
  refuelsApi.readRefuelsPage.mockResolvedValue({
    items: [refuel({ invoicePhotoPath: 'orgs/org-a/refuels/r1/invoice.jpg' })],
    cursor: null,
  })
  await openRefuels()
  fireEvent.click(await screen.findByRole('button', { name: 'Ver factura' }))
  expect(await screen.findByAltText('Factura del relleno')).toHaveAttribute(
    'src',
    'https://example.com/factura.jpg'
  )
  expect(refuelsApi.invoiceUrl).toHaveBeenCalledWith(
    'orgs/org-a/refuels/r1/invoice.jpg'
  )
})
