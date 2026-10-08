import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import { useExpensesStore } from 'store/expenses'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import { useTripsStore } from 'store/trips'
import type { Role } from 'utils/roles'
import {
  accountWithRole,
  client,
  driver,
  expense,
  presetCategories,
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
  saveTripWithExpenses: vi.fn((..._args: unknown[]) => Promise.resolve()),
  deleteTrip: vi.fn(() => Promise.resolve()),
}))
vi.mock('services/trips', () => tripsApi)

const expensesApi = vi.hoisted(() => ({
  readCategories: vi.fn(),
  seedCategories: vi.fn(),
  readTripExpenses: vi.fn(),
  newExpenseId: vi.fn(() => 'new-expense'),
}))
vi.mock('services/expenses', () => expensesApi)

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
  useExpensesStore.getState().reset()
  expensesApi.readCategories.mockResolvedValue(presetCategories())
  expensesApi.readTripExpenses.mockResolvedValue([])
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
      trip({ expensesTotal: 3200 }),
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
  ).toEqual(['Historial', 'Medición', 'Flota', 'Viajes', 'Gastos'])
  expect(within(nav).getByRole('link', { name: 'Viajes' })).toHaveAttribute(
    'aria-current',
    'page'
  )
})

// RF-6, CA-6
describe('the list', () => {
  test('totals leave the cancelled out; each trip has its route and income', async () => {
    renderAt('/viajes')

    const totals = await screen.findByRole('status', {
      name: 'Totales del periodo',
    })
    expect(totals).toHaveTextContent('2 viajes')
    // specs/0026 RF-14, CA-7: expenses and profit from each expensesTotal
    expect(totals).toHaveTextContent('IngresosC$45,500.00 NIO')
    expect(totals).toHaveTextContent('GastosC$3,200.00 NIO')
    expect(totals).toHaveTextContent('UtilidadC$42,300.00 NIO')
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
    ).toHaveTextContent('1 viajeIngresosC$18,000.00 NIO')
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
      expect(tripsApi.saveTripWithExpenses).toHaveBeenCalledWith(
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
        }),
        true,
        expect.objectContaining({ create: [], update: [], remove: [] })
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
    expect(tripsApi.saveTripWithExpenses).not.toHaveBeenCalled()

    await choose('Estado', 'En curso')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar viaje' }))
    await waitFor(() => {
      expect(tripsApi.saveTripWithExpenses).toHaveBeenCalledWith(
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
        }),
        true,
        expect.anything()
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

// backend specs/0026 RF-12
describe('its expenses in the form', () => {
  // CA-3
  test('a new trip saves its expense rows with it, in one batch', async () => {
    renderAt('/viajes/nuevo')

    await choose('Cliente', 'Transportes Pérez')
    await choose('Tarifa', 'Managua - San José - C$25,000.00')
    await choose('Camión', 'Unidad 12')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar gasto' }))
    const row = screen.getByRole('group', { name: 'Gasto 1' })
    await choose('Categoría', 'Peajes', row)
    fireEvent.change(within(row).getByLabelText('Monto'), {
      target: { value: '1850' },
    })
    fireEvent.change(within(row).getByLabelText('Descripción (opcional)'), {
      target: { value: 'Peaje de Tipitapa' },
    })
    expect(screen.getByText('Gastos: C$1,850.00 NIO')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar viaje' }))

    await waitFor(() => {
      expect(tripsApi.saveTripWithExpenses.mock.lastCall).toMatchObject([
        'new-trip',
        'org-a',
        { truckId: 'truck-1' },
        true,
        {
          create: [
            {
              id: 'new-expense',
              fields: {
                kind: 'trip',
                tripId: 'new-trip',
                tripRoute: 'Managua → San José',
                // The trip's truck and trailer go with it (RF-2)
                truckId: 'truck-1',
                trailerId: 'trailer-1',
                amount: 1850,
                currency: 'NIO',
                categoryId: 'org-a_tolls',
                categoryName: 'Peajes',
                description: 'Peaje de Tipitapa',
              },
            },
          ],
          update: [],
          remove: [],
        },
      ])
    })
  })

  // CA-4
  test('editing: a removed row is deleted; a changed one keeps its driver and photo', async () => {
    tripsApi.readTrip.mockResolvedValue(trip())
    expensesApi.readTripExpenses.mockResolvedValue([
      expense(),
      expense({
        id: 'expense-2',
        categoryId: 'org-a_per_diem',
        categoryName: 'Viáticos',
        amount: 1350,
        driverId: 'driver-1',
        driverName: 'Pedro Ruiz',
        receiptPhotoPath: 'orgs/org-a/expenses/expense-2/receipt.jpg',
      }),
    ])
    renderAt('/viajes/trip-1/editar')

    const first = await screen.findByRole('group', { name: 'Gasto 1' })
    expect(within(first).getByLabelText('Monto')).toHaveValue('1,850')
    expect(screen.getByText('Gastos: C$3,200.00 NIO')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar el gasto 1' }))
    fireEvent.change(
      within(screen.getByRole('group', { name: 'Gasto 1' })).getByLabelText(
        'Monto'
      ),
      { target: { value: '1500' } }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(tripsApi.saveTripWithExpenses.mock.lastCall).toMatchObject([
        'trip-1',
        'org-a',
        {},
        false,
        {
          create: [],
          update: [
            {
              id: 'expense-2',
              fields: {
                amount: 1500,
                categoryName: 'Viáticos',
                driverId: 'driver-1',
                receiptPhotoPath: 'orgs/org-a/expenses/expense-2/receipt.jpg',
              },
            },
          ],
          remove: ['expense-1'],
        },
      ])
    })
  })

  // backend specs/0027 RF-10: a refuel's is shown, not a row, and stays
  test("a refuel's expense is shown apart and is never removed", async () => {
    tripsApi.readTrip.mockResolvedValue(trip())
    expensesApi.readTripExpenses.mockResolvedValue([
      expense(),
      expense({
        id: 'r1',
        refuelId: 'r1',
        categoryId: 'org-a_fuel',
        categoryName: 'Combustible',
        amount: 4500,
        description: 'Relleno de Tanque izquierdo',
      }),
    ])
    renderAt('/viajes/trip-1/editar')

    const refuels = await screen.findByRole('list', {
      name: 'Gastos de rellenos',
    })
    expect(refuels).toHaveTextContent('CombustibleC$4,500.00 NIO')
    expect(refuels).toHaveTextContent('Relleno de Tanque izquierdo')
    expect(screen.queryByRole('group', { name: 'Gasto 2' })).toBeNull()
    expect(screen.getByText('Gastos: C$6,350.00 NIO')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Quitar el gasto 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => {
      expect(tripsApi.saveTripWithExpenses.mock.lastCall).toMatchObject([
        'trip-1',
        'org-a',
        {},
        false,
        { create: [], update: [], remove: ['expense-1'] },
      ])
    })
  })

  // Audit 0027 (0025 RF-9): Manual keeps the chosen rate's values
  test('Manual takes the values of the rate chosen last', async () => {
    renderAt('/viajes/nuevo')
    await choose('Cliente', 'Transportes Pérez')
    await choose('Tarifa', 'Managua - San José - C$25,000.00')
    await choose('¿Cómo se calcula el precio?', 'Manual')
    expect(screen.getByLabelText('Origen')).toHaveValue('Managua')
    await choose('¿Cómo se calcula el precio?', 'Desde una tarifa')
    await choose('Tarifa', 'León - Managua - C$9,000.00 · Fletes Ríos')
    await choose('¿Cómo se calcula el precio?', 'Manual')
    expect(screen.getByLabelText('Origen')).toHaveValue('León')
    expect(screen.getByLabelText('Precio')).toHaveValue('9,000')
  })

  // Audit 0027: "Sin remolque" chosen is not replaced by the truck's
  test('a trailer left out stays out when the truck is chosen', async () => {
    renderAt('/viajes/nuevo')
    // Chosen and taken back out: a choice, unlike the field never touched
    await choose('Remolque (opcional)', 'Caja 7')
    await choose('Remolque (opcional)', 'Sin remolque')
    await choose('Camión', 'Unidad 12')
    // The truck's hitched trailer is Caja 7: it is not put back
    expect(
      screen.getByRole('combobox', { name: 'Remolque (opcional)' })
    ).not.toHaveValue('Caja 7')
  })

  // Audit 0027: an edited trip with its rate shows the copy it saves
  test("editing with the same rate shows the trip's copy, not the rate's new price", async () => {
    tripsApi.readTrip.mockResolvedValue(trip())
    fleetApi.readFleet.mockResolvedValue({
      clients: [client()],
      trucks: [truck()],
      trailers: [trailer()],
      tanks: [],
      drivers: [driver()],
      rates: [
        rate({ price: 30000, label: 'Managua - San José - C$30,000.00' }),
      ],
    })
    renderAt('/viajes/trip-1/editar')
    expect(
      await screen.findByText('Managua → San José · C$25,000.00 NIO')
    ).toBeInTheDocument()
    expect(screen.getByText('Ingresos: C$27,500.00 NIO')).toBeInTheDocument()
  })

  test('a row needs its category and amount', async () => {
    renderAt('/viajes/nuevo')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Agregar gasto' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Guardar viaje' }))
    const row = screen.getByRole('group', { name: 'Gasto 1' })
    expect(
      await within(row).findByText('Elige la categoría')
    ).toBeInTheDocument()
    expect(within(row).getByText('Escribe el monto')).toBeInTheDocument()
    expect(tripsApi.saveTripWithExpenses).not.toHaveBeenCalled()
  })
})

// backend specs/0026 RF-13
describe('its expenses on its screen', () => {
  beforeEach(() => {
    tripsApi.readTrip.mockResolvedValue(trip({ expensesTotal: 32000 }))
    expensesApi.readTripExpenses.mockResolvedValue([
      expense(),
      expense({ id: 'expense-2', amount: 150, description: 'Tipitapa' }),
      expense({
        id: 'expense-3',
        categoryId: 'org-a_per_diem',
        categoryName: 'Viáticos',
        amount: 30000,
      }),
    ])
  })

  // CA-3
  test('each category adds up, and a loss is in red', async () => {
    renderAt('/viajes/trip-1')

    const section = await screen.findByRole('region', { name: 'Gastos' })
    await within(section).findByText('Peajes')
    expect(section).toHaveTextContent('ViáticosC$30,000.00 NIO')
    expect(section).toHaveTextContent('PeajesC$2,000.00 NIO')
    expect(section).toHaveTextContent('Total de gastosC$32,000.00 NIO')
    const profit = within(section).getByText('-C$4,500.00 NIO')
    // In the error color, unlike its label
    expect(getComputedStyle(profit).color).not.toBe(
      getComputedStyle(within(section).getByText('Utilidad')).color
    )
    expect(
      within(section).getByRole('button', {
        name: 'Gasto: 6 oct · Peajes · Tipitapa, C$150.00 NIO',
      })
    ).toBeInTheDocument()

    fireEvent.click(
      within(section).getByRole('button', { name: 'Agregar gasto' })
    )
    expect(window.location.pathname).toBe('/gastos/nuevo')
    expect(window.location.search).toBe('?viaje=trip-1')
  })

  // As the backend's expensesTotal (RF-3): only the trip's currency adds up
  test('an expense in another currency is listed apart, not in the total', async () => {
    expensesApi.readTripExpenses.mockResolvedValue([
      expense(),
      expense({ id: 'expense-usd', currency: 'USD', amount: 100 }),
    ])
    renderAt('/viajes/trip-1')

    const section = await screen.findByRole('region', { name: 'Gastos' })
    await within(section).findAllByText('Peajes')
    expect(section).toHaveTextContent('Peajes$100.00 USD')
    expect(section).toHaveTextContent('Total de gastosC$1,850.00 NIO')
  })

  // CA-5
  test('deleting says its expenses stay with the truck', async () => {
    renderAt('/viajes/trip-1')
    await within(
      await screen.findByRole('region', { name: 'Gastos' })
    ).findByText('Peajes')

    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(
      await screen.findByText(
        'Sus 3 gastos quedarán como gastos del camión Unidad 12. No se puede deshacer.'
      )
    ).toBeInTheDocument()
  })
})
