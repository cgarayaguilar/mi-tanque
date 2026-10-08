import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import { useTripsStore } from 'store/trips'
import type { Role } from 'utils/roles'
import {
  accountWithRole,
  client,
  driver,
  rate,
  trailer,
  trip,
  truck,
} from '../../testing/fleetFixtures'
import { choose } from '../../testing/choose'
import { filterBy } from '../../testing/filterBy'

const fleetApi = vi.hoisted(() => ({
  readFleet: vi.fn(),
  readMembers: vi.fn(() =>
    Promise.resolve([
      { uid: 'luis', displayName: 'Luis', role: 'owner' },
      { uid: 'ana', displayName: 'Ana López', role: 'driver' },
    ])
  ),
  newFleetId: vi.fn(() => 'new-client'),
  createFleetItem: vi.fn(() => Promise.resolve()),
}))
vi.mock('services/fleet', () => fleetApi)

const tripsApi = vi.hoisted(() => ({
  readTripsInPeriod: vi.fn(),
  readTrip: vi.fn(),
  newTripId: vi.fn(() => 'new-trip'),
  createTrip: vi.fn(() => Promise.resolve()),
  updateTrip: vi.fn(() => Promise.resolve()),
  deleteTrip: vi.fn(() => Promise.resolve()),
}))
vi.mock('services/trips', () => tripsApi)

const signIn = (role: Role = 'owner') => {
  useSessionStore.setState({
    status: 'ready',
    user: { uid: 'luis', displayName: 'Luis', email: null, phoneNumber: null },
    ...accountWithRole(role),
    start: () => Promise.resolve(),
  })
}

const renderAt = (path: string) => {
  window.history.pushState({}, '', path)
  render(<App />)
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

beforeEach(() => {
  useFleetStore.getState().reset()
  useTripsStore.getState().reset()
  fleetApi.readFleet.mockResolvedValue({
    clients: [client(), client({ id: 'client-2', name: 'Fletes Ríos' })],
    trucks: [truck({ assignedDriverUid: 'ana' })],
    trailers: [trailer({ hitchedTruckId: 'truck-1' })],
    tanks: [],
    drivers: [
      driver({ memberUid: 'ana' }),
      driver({ id: 'driver-2', name: 'Marta Gómez' }),
    ],
    rates: [
      rate(),
      rate({
        id: 'rate-2',
        name: 'León → Managua',
        origin: 'León',
        destination: 'Managua',
        price: 9000,
        clientId: 'client-2',
        clientName: 'Fletes Ríos',
        label: 'León - Managua - C$9,000.00',
      }),
    ],
  })
  tripsApi.readTripsInPeriod.mockResolvedValue({
    items: [
      trip(),
      trip({
        id: 'trip-2',
        origin: 'León',
        destination: 'Tegucigalpa',
        mode: 'manual',
        rateId: null,
        price: 18000,
        extras: [],
        status: 'in_progress',
        clientId: 'client-2',
        clientName: 'Fletes Ríos',
        driverId: 'driver-2',
        driverName: 'Marta Gómez',
        driverIds: ['driver-2'],
        startAt: new Date(2026, 9, 3, 9, 0),
      }),
      trip({
        id: 'trip-3',
        status: 'cancelled',
        startAt: new Date(2026, 9, 2, 9, 0),
      }),
    ],
    truncated: false,
  })
  tripsApi.readTrip.mockResolvedValue(null)
  signIn()
})

afterEach(() => {
  vi.clearAllMocks()
})

// backend specs/0025 RF-5
test('with a session the bar has Viajes, active on its page', async () => {
  renderAt('/viajes')
  const nav = await screen.findByRole('navigation', { name: 'Secciones' })
  expect(
    within(nav)
      .getAllByRole('link')
      .map(link => link.textContent)
  ).toEqual(['Historial', 'Medición', 'Flota', 'Viajes'])
  expect(within(nav).getByRole('link', { name: 'Viajes' })).toHaveAttribute(
    'aria-current',
    'page'
  )
})

// RF-6, CA-6
describe('the list', () => {
  test('totals leave the cancelled out; each trip has its route and income', async () => {
    renderAt('/viajes')

    expect(
      await screen.findByRole('status', { name: 'Totales del periodo' })
    ).toHaveTextContent('2 viajes · C$45,500.00 NIO')
    const list = screen.getByRole('list', { name: 'Viajes' })
    const cards = within(list).getAllByRole('button')
    expect(cards.map(card => card.getAttribute('aria-label'))).toEqual([
      'Viaje Managua → San José, Programado',
      'Viaje León → Tegucigalpa, En curso',
      'Viaje Managua → San José, Cancelado',
    ])
    expect(cards[0]).toHaveTextContent('C$27,500.00 NIO')
    expect(cards[0]).toHaveTextContent('Transportes Pérez')
    expect(cards[0]).toHaveTextContent('Unidad 12 · Pedro Ruiz')
    // The current month by default
    expect(tripsApi.readTripsInPeriod).toHaveBeenCalledWith(
      'org-a',
      expect.any(Date),
      expect.any(Date)
    )
  })

  test('the driver filter leaves theirs, and the totals follow', async () => {
    renderAt('/viajes')
    await screen.findByRole('list', { name: 'Viajes' })

    await filterBy('Conductor', 'Marta Gómez')
    expect(
      screen.getByRole('status', { name: 'Totales de lo filtrado' })
    ).toHaveTextContent('1 viaje · C$18,000.00 NIO')
    expect(
      within(screen.getByRole('list', { name: 'Viajes' })).getAllByRole(
        'button'
      )
    ).toHaveLength(1)
  })

  test('an empty period invites to add one; a viewer sees no "Agregar"', async () => {
    tripsApi.readTripsInPeriod.mockResolvedValue({
      items: [],
      truncated: false,
    })
    renderAt('/viajes')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Agregar viaje' })
    )
    expect(window.location.pathname).toBe('/viajes/nuevo')
  })

  test('a viewer reads the list without adding', async () => {
    signIn('viewer')
    renderAt('/viajes')
    await screen.findByRole('list', { name: 'Viajes' })
    expect(screen.queryByRole('button', { name: 'Agregar' })).toBeNull()
  })
})

// RF-9, RF-10
describe('the form', () => {
  // CA-1
  test('a trip from a rate: the truck brings its trailer and driver', async () => {
    signIn('driver')
    renderAt('/viajes/nuevo')

    await choose('Cliente', 'Transportes Pérez')
    await choose('Tarifa', 'Managua - San José - C$25,000.00')
    expect(
      screen.getByText('Managua → San José · C$25,000.00 NIO')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar ingreso' }))
    type('Descripción', 'Parada en León')
    type('Monto', '2500')
    expect(screen.getByText('Ingresos: C$27,500.00 NIO')).toBeInTheDocument()
    await choose('Camión', 'Unidad 12')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar viaje' }))

    await waitFor(() => {
      expect(tripsApi.createTrip).toHaveBeenCalledWith(
        'new-trip',
        'org-a',
        expect.objectContaining({
          status: 'scheduled',
          mode: 'rate',
          rateId: 'rate-1',
          price: 25000,
          extras: [{ description: 'Parada en León', amount: 2500 }],
          clientId: 'client-1',
          truckId: 'truck-1',
          // Hitched to the truck, and linked to its assigned member
          trailerId: 'trailer-1',
          driverId: 'driver-1',
          driverIds: ['driver-1'],
        })
      )
    })
    expect(sileo.success).toHaveBeenCalledWith({ title: 'Viaje guardado' })
    expect(window.location.pathname).toBe('/viajes/new-trip')
  })

  test('a rate of another client moves the trip to that client, and says so', async () => {
    renderAt('/viajes/nuevo')
    await choose('Cliente', 'Transportes Pérez')
    await choose('Tarifa', 'León - Managua - C$9,000.00 · Fletes Ríos')
    expect(
      screen.getByText('Cambiamos el cliente a Fletes Ríos, el de la tarifa')
    ).toBeInTheDocument()
  })

  // CA-2, CA-4
  test('a manual trip with two drivers; done needs its end', async () => {
    renderAt('/viajes/nuevo')

    await choose('Cliente', 'Fletes Ríos')
    await choose('¿Cómo se calcula el precio?', 'Manual')
    type('Origen', 'León')
    type('Destino', 'Tegucigalpa')
    type('Precio', '18000')
    await choose('Camión', 'Unidad 12')
    fireEvent.click(
      screen.getByRole('button', { name: 'Agregar segundo conductor' })
    )
    await choose('Segundo conductor', 'Marta Gómez')
    await choose('Estado', 'Terminado')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar viaje' }))
    expect(
      await screen.findByText('Para terminarlo, pon la fecha y hora de fin')
    ).toBeInTheDocument()
    expect(tripsApi.createTrip).not.toHaveBeenCalled()

    await choose('Estado', 'En curso')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar viaje' }))
    await waitFor(() => {
      expect(tripsApi.createTrip).toHaveBeenCalledWith(
        'new-trip',
        'org-a',
        expect.objectContaining({
          mode: 'manual',
          rateId: null,
          origin: 'León',
          destination: 'Tegucigalpa',
          price: 18000,
          status: 'in_progress',
          driverIds: ['driver-1', 'driver-2'],
        })
      )
    })
  })

  // CA-5
  test('"Nuevo cliente" creates one and chooses it', async () => {
    renderAt('/viajes/nuevo')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nuevo cliente' })
    )
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo cliente' })
    fireEvent.change(within(dialog).getByLabelText('Nombre del cliente'), {
      target: { value: 'transportes perez' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar cliente' })
    )
    expect(
      await within(dialog).findByText('Ya existe un cliente con ese nombre')
    ).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Nombre del cliente'), {
      target: { value: 'Acarreos del Norte' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar cliente' })
    )
    await waitFor(() => {
      expect(fleetApi.createFleetItem).toHaveBeenCalledWith(
        'clients',
        'new-client',
        'org-a',
        expect.objectContaining({ name: 'Acarreos del Norte' })
      )
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveValue(
      'Acarreos del Norte'
    )
  })
})

// RF-8, CA-7
describe('the trip', () => {
  test('its screen shows the income, line by line', async () => {
    renderAt('/viajes')
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Viaje Managua → San José, Programado',
      })
    )

    expect(
      await screen.findByRole('heading', { name: 'Managua → San José' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Semana del 5 oct al 11 oct · octubre 2026')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Desde la tarifa Managua - San José - C$25,000.00')
    ).toBeInTheDocument()
    const income = screen.getByRole('region', { name: 'Ingresos' })
    expect(income).toHaveTextContent('Precio del viajeC$25,000.00 NIO')
    expect(income).toHaveTextContent('Parada en LeónC$2,500.00 NIO')
    expect(income).toHaveTextContent('TotalC$27,500.00 NIO')
  })

  test('deleting asks first, then the trip goes', async () => {
    tripsApi.readTrip.mockResolvedValue(trip())
    renderAt('/viajes/trip-1')

    fireEvent.click(await screen.findByRole('button', { name: 'Borrar' }))
    const dialog = await screen.findByRole('dialog', {
      name: '¿Borrar el viaje Managua → San José?',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Borrar' }))

    await waitFor(() => {
      expect(tripsApi.deleteTrip).toHaveBeenCalledWith('trip-1')
    })
    expect(sileo.success).toHaveBeenCalledWith({ title: 'Viaje borrado' })
    expect(window.location.pathname).toBe('/viajes')
  })

  test('a viewer sees it without editing or deleting', async () => {
    signIn('viewer')
    tripsApi.readTrip.mockResolvedValue(trip())
    renderAt('/viajes/trip-1')

    expect(
      await screen.findByRole('heading', { name: 'Managua → San José' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull()
  })
})
