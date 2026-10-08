import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
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

const fleetApi = vi.hoisted(() => ({
  readFleet: vi.fn(),
  readMembers: vi.fn(() => Promise.resolve([])),
}))
vi.mock('services/fleet', () => fleetApi)

const refuelsApi = vi.hoisted(() => ({
  createCloudRefuel: vi.fn(() => Promise.resolve()),
  addRefuelLocation: vi.fn(() => Promise.resolve()),
  readStations: vi.fn(() => Promise.resolve(['Puma Km 7', 'Uno Masaya'])),
}))
vi.mock('services/cloudRefuels', () => refuelsApi)

const queue = vi.hoisted(() => ({
  enqueueInvoice: vi.fn(() => Promise.resolve()),
  processInvoiceQueue: vi.fn(() => Promise.resolve(1)),
}))
vi.mock('services/invoiceQueue', () => queue)

// Canvas is not available in jsdom: the compressed photo is the file itself
const photos = vi.hoisted(() => ({
  compressImage: vi.fn((file: Blob) => Promise.resolve(file)),
}))
vi.mock('utils/compressImage', () => ({
  PHOTO_MAX_SIDE: 1600,
  compressImage: photos.compressImage,
}))

const LAST = { id: 'm', takenAt: new Date(), fillPercent: 50 }
const LEFT = tank({ lastMeasurement: { ...LAST, gallons: 40 } })
const RIGHT = tank({
  id: 'tank-2',
  name: 'Tanque derecho',
  shape: 'cylinder',
  dimensions: { diameterIn: 26, lengthIn: 48 },
  capacityGal: 100,
  lastMeasurement: { ...LAST, gallons: 55 },
})

const signIn = (role: Role = 'driver') => {
  useSessionStore.setState({
    status: 'ready',
    user: { uid: 'luis', displayName: 'Luis', email: null, phoneNumber: null },
    ...accountWithRole(role),
    start: () => Promise.resolve(),
  })
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

const openRefuel = async () => {
  window.history.pushState({}, '', '/')
  render(<App />)
  await pickTank('Tanque izquierdo')
  fireEvent.click(screen.getByRole('button', { name: 'Rellenar' }))
  return screen.findByRole('form', { name: 'Nuevo relleno' })
}

/** Picks a tank of the chosen equipment from its card's menu. */
const pickTank = async (name: string) => {
  fireEvent.click(
    await screen.findByRole('button', { name: /^(Cambiar|Elegir) tanque/ })
  )
  fireEvent.click(
    await screen.findByRole('menuitem', { name: new RegExp(`^${name}`) })
  )
}

beforeEach(() => {
  window.localStorage.clear()
  useFleetStore.getState().reset()
  fleetApi.readFleet.mockResolvedValue({
    drivers: [],
    clients: [],
    trucks: [truck()],
    trailers: [trailer()],
    tanks: [LEFT, RIGHT],
  })
  signIn()
})

afterEach(() => {
  vi.clearAllMocks()
  Reflect.deleteProperty(navigator, 'geolocation')
})

test('a truck refuel saves the amounts, the levels and the truck totals (CA-1, RF-9)', async () => {
  await openRefuel()
  // The organization's currency is proposed
  expect(screen.getByLabelText('Moneda')).toHaveValue(
    'Córdobas nicaragüenses (C$)'
  )
  type('Cantidad echada', '50')
  type('Precio', '30')
  // specs/0012 RF-11: the odometer waits in "Ver más detalles"
  fireEvent.click(screen.getByRole('button', { name: 'Ver más detalles' }))
  type('Odómetro (opcional)', '120600')
  type('Gasolinera (opcional)', 'Puma Km 7')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar relleno' }))

  await waitFor(() => {
    expect(refuelsApi.createCloudRefuel).toHaveBeenCalled()
  })
  expect(refuelsApi.createCloudRefuel).toHaveBeenCalledWith(
    expect.objectContaining({
      orgId: ORG_ID,
      tankId: 'tank-1',
      equipment: { kind: 'truck', id: 'truck-1', name: 'Unidad 12' },
      userId: 'luis',
      odometerKm: 120600,
      values: expect.objectContaining({
        gallonsAdded: 13.21,
        litersAdded: 50,
        currency: 'NIO',
        total: 1500,
        gallonsBefore: 40,
        gallonsAfter: 53.21,
        stationName: 'Puma Km 7',
      }) as unknown,
      // The other tank of the truck (55 gal) adds to both totals
      totals: { truckGallonsBefore: 95, truckGallonsAfter: 108.21 },
    })
  )
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Relleno guardado' })
  expect(queue.enqueueInvoice).not.toHaveBeenCalled()
})

// specs/0012 CA-7: a wrong odometer in the closed section opens it
test('an invalid odometer opens "Ver más detalles" and is focused', async () => {
  await openRefuel()
  type('Cantidad echada', '50')
  type('Precio', '30')
  const toggle = screen.getByRole('button', { name: 'Ver más detalles' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  type('Odómetro (opcional)', '99999999')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar relleno' }))

  await waitFor(() => {
    expect(screen.getByLabelText('Odómetro (opcional)')).toHaveFocus()
  })
  expect(
    screen.getByRole('button', { name: 'Ocultar detalles' })
  ).toHaveAttribute('aria-expanded', 'true')
  expect(refuelsApi.createCloudRefuel).not.toHaveBeenCalled()
})

test('stations are suggested from the organization (RF-5)', async () => {
  await openRefuel()
  await waitFor(() => {
    expect(document.querySelectorAll('datalist option').length).toBe(2)
  })
  expect(screen.getByLabelText('Gasolinera (opcional)')).toHaveAttribute('list')
})

// Regression: a photo that could not be compressed was dropped without a word
test('a photo that cannot be used is said', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  photos.compressImage.mockRejectedValueOnce(new Error('not an image'))
  await openRefuel()
  const input = document.querySelector<HTMLInputElement>('input[type=file]')
  if (!input) throw new Error('No file input')
  fireEvent.change(input, {
    target: { files: [new File(['x'], 'raro.heic', { type: 'image/heic' })] },
  })

  await waitFor(() => {
    expect(sileo.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No pudimos usar esa foto' })
    )
  })
})

test('the invoice photo is queued and the queue runs (RF-6)', async () => {
  await openRefuel()
  type('Cantidad echada', '20')
  type('Precio', '30')
  const file = new File(['jpg'], 'factura.jpg', { type: 'image/jpeg' })
  const input = document.querySelector<HTMLInputElement>('input[type=file]')
  if (!input) throw new Error('No file input')
  fireEvent.change(input, { target: { files: [file] } })
  expect(await screen.findByAltText('Factura elegida')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar relleno' }))

  await waitFor(() => {
    expect(queue.enqueueInvoice).toHaveBeenCalled()
  })
  const [call] = refuelsApi.createCloudRefuel.mock.calls as unknown as [
    [{ id: string }],
  ]
  expect(queue.enqueueInvoice).toHaveBeenCalledWith({
    refuelId: call[0].id,
    orgId: ORG_ID,
    uid: 'luis',
    photo: file,
  })
  await waitFor(() => {
    expect(queue.processInvoiceQueue).toHaveBeenCalledWith('luis')
  })
})

test('Lectura cannot register refuels', async () => {
  signIn('viewer')
  await openRefuel()
  expect(screen.getByRole('button', { name: 'Guardar relleno' })).toBeDisabled()
  expect(
    screen.getByText('Con tu rol de Lectura no puedes registrar rellenos.')
  ).toBeInTheDocument()
})
