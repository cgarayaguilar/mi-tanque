import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import TripForm from 'pages/TripEditor/TripForm'
import type { TripDocument } from 'schemas/tripDocuments'
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
import { filterBy, filterChip } from '../../testing/filterBy'

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
  photoUrl: vi.fn(() => Promise.resolve('https://files.test/document')),
}))
vi.mock('services/fleet', () => fleetApi)

const documentsApi = vi.hoisted(() => ({
  readTripDocuments: vi.fn(),
  uploadTripDocument: vi.fn(),
  renameTripDocument: vi.fn(() => Promise.resolve()),
  deleteTripDocument: vi.fn(() => Promise.resolve()),
  newTripDocumentId: vi.fn(() => 'new-document'),
  PHOTO_TOO_BIG: 'trip-document-photo-too-big',
}))
vi.mock('services/tripDocuments', () => documentsApi)

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

/** "+ Crear …" from a list, after typing in it (specs/0028). */
const createFrom = async (label: string, text: string) => {
  const field = await screen.findByRole('combobox', {
    name: new RegExp(`^${label.replace(/[()]/g, '\\$&')}`),
  })
  field.focus()
  fireEvent.change(field, { target: { value: text } })
  fireEvent.click(await screen.findByRole('option', { name: /^\+ Crear/ }))
}

const type = (
  label: string,
  value: string,
  scope: HTMLElement = document.body
) => {
  fireEvent.change(within(scope).getByLabelText(label), { target: { value } })
}

/** The income's or the expense's dialog, open (specs/0029). */
const openDialog = async (button: string, title: string) => {
  fireEvent.click(await screen.findByRole('button', { name: button }))
  return screen.getByRole('dialog', { name: title })
}

/** Its "Guardar", which closes it once its values are valid. */
const saveDialog = async (dialog: HTMLElement) => {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
  await waitFor(() => {
    expect(dialog).not.toBeInTheDocument()
  })
}

/** "Quitar" in a card's ⋮ menu, confirmed (specs/0029 RF-5). */
const removeFromMenu = (menu: string) => {
  fireEvent.click(screen.getByRole('button', { name: menu }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Quitar' }))
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Quitar' })
  )
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
  documentsApi.readTripDocuments.mockResolvedValue([])
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
  ).toEqual(['Historial', 'Medición', 'Viajes', 'Gastos', 'Más'])
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

// backend specs/0030
describe('filter, group and sort', () => {
  const cardsIn = (list: HTMLElement) =>
    within(list)
      .getAllByRole('button')
      .map(card => card.getAttribute('aria-label'))

  // CA-1
  test('every filter is there; Destino and Camión add up', async () => {
    renderAt('/viajes')
    await screen.findByRole('list', { name: 'Viajes' })

    // One truck in the period: its chip is there all the same
    expect(filterChip('Camión')).toBeInTheDocument()
    // specs/0033 RF-1: each route under its client
    fireEvent.click(filterChip('Destino'))
    const menu = await screen.findByRole('menu', { name: 'Destino' })
    expect(menu).toHaveTextContent(
      /Fletes Ríos.*León → Tegucigalpa.*Transportes Pérez.*Managua → San José/
    )
    fireEvent.click(
      within(menu).getByRole('menuitemradio', { name: 'Managua → San José' })
    )
    await filterBy('Camión', 'Unidad 12')
    expect(cardsIn(screen.getByRole('list', { name: 'Viajes' }))).toEqual([
      'Viaje Managua → San José, Programado',
      'Viaje Managua → San José, Cancelado',
    ])
    expect(
      screen.getByRole('status', { name: 'Totales de lo filtrado' })
    ).toHaveTextContent('1 viajeIngresosC$27,500.00 NIO')
  })

  // CA-2, CA-3
  test('grouped by driver: what each one brought in', async () => {
    renderAt('/viajes')
    await screen.findByRole('list', { name: 'Viajes' })

    await filterBy('Agrupar', 'Conductor')
    expect(filterChip('Agrupar')).toHaveTextContent('Agrupar: Conductor')
    const groups = screen.getAllByRole('heading', { level: 2 })
    expect(groups.map(group => group.textContent)).toEqual([
      'Marta Gómez',
      'Pedro Ruiz',
    ])
    const pedro = screen.getByRole('region', { name: 'Pedro Ruiz' })
    // The cancelled one is there, but does not count
    expect(pedro).toHaveTextContent('1 viaje · C$27,500.00 NIO')
    expect(
      cardsIn(within(pedro).getByRole('list', { name: 'Viajes de Pedro Ruiz' }))
    ).toHaveLength(2)
  })

  // CA-5
  test('by price, the lowest first', async () => {
    renderAt('/viajes')
    await screen.findByRole('list', { name: 'Viajes' })

    await filterBy('Ordenar', 'Precio, menor primero')
    expect(filterChip('Ordenar')).toHaveTextContent(
      'Ordenar: Precio, menor primero'
    )
    // A tie goes newest first
    expect(cardsIn(screen.getByRole('list', { name: 'Viajes' }))).toEqual([
      'Viaje León → Tegucigalpa, En curso',
      'Viaje Managua → San José, Programado',
      'Viaje Managua → San José, Cancelado',
    ])
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ordenar por fecha, más reciente primero',
      })
    )
    expect(cardsIn(screen.getByRole('list', { name: 'Viajes' }))[0]).toBe(
      'Viaje Managua → San José, Programado'
    )
  })

  // CA-6
  test('back from a trip, the list is as it was', async () => {
    renderAt('/viajes')
    await screen.findByRole('list', { name: 'Viajes' })
    await filterBy('Agrupar', 'Camión')
    await filterBy('Destino', 'Managua → San José')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Viaje Managua → San José, Programado',
      })
    )
    expect(window.location.pathname).toBe('/viajes/trip-1')
    act(() => {
      window.history.back()
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe('/viajes')
    })
    expect(
      await screen.findByRole('region', { name: 'Unidad 12' })
    ).toHaveTextContent('1 viaje · C$27,500.00 NIO')
    expect(filterChip('Destino')).toHaveTextContent('Managua → San José')
  })
})

// backend specs/0035 CA-4: trips by whose their truck and trailer were
test("the trips of a third party's truck, marked on their card", async () => {
  tripsApi.readTripsInPeriod.mockResolvedValue({
    items: [
      trip(),
      trip({
        id: 'trip-2',
        origin: 'León',
        truckOwnership: 'third_party',
      }),
      // From before: read as its trailer is now
      trip({ id: 'trip-3', origin: 'Rivas', trailerOwnership: null }),
    ],
    truncated: false,
  })
  fleetApi.readFleet.mockResolvedValue({
    clients: [client()],
    trucks: [truck()],
    trailers: [trailer({ ownership: 'third_party' })],
    tanks: [],
    drivers: [driver()],
    rates: [],
  })
  renderAt('/viajes')
  await screen.findByRole('list', { name: 'Viajes' })

  await filterBy('Dueño del camión', 'De un tercero')
  const list = screen.getByRole('list', { name: 'Viajes' })
  const cards = within(list).getAllByRole('button')
  expect(cards).toHaveLength(1)
  expect(cards[0]).toHaveTextContent('Unidad 12 (de un tercero)')

  await filterBy('Dueño del camión', 'Todos')
  await filterBy('Dueño del remolque', 'De un tercero')
  expect(
    within(screen.getByRole('list', { name: 'Viajes' }))
      .getAllByRole('button')
      .map(card => card.getAttribute('aria-label'))
  ).toEqual(['Viaje Rivas → San José, Programado'])
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
    const income = await openDialog('Agregar ingreso', 'Nuevo ingreso')
    type('Descripción', 'Parada en León', income)
    type('Monto', '2500', income)
    await saveDialog(income)
    expect(
      screen.getByRole('button', {
        name: 'Ingreso de Parada en León, C$2,500.00 NIO',
      })
    ).toBeInTheDocument()
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
    // specs/0033 RF-3, CA-3: under their client, the trip's first
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Tarifa' }))
    const list = await screen.findByRole('listbox')
    expect(list).toHaveTextContent(
      /^\+ Crear tarifaTransportes Pérez.*Managua - San José.*Fletes Ríos.*León - Managua/
    )
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Tarifa' }), {
      key: 'Escape',
    })
    await choose('Tarifa', 'León - Managua - C$9,000.00')
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
  // backend specs/0028 CA-5: "+ Crear cliente" in the list
  test('"+ Crear cliente" in the list creates one and chooses it', async () => {
    renderAt('/viajes/nuevo')
    expect(
      await screen.findByRole('combobox', { name: 'Cliente' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).toBeNull()

    await createFrom('Cliente', 'transportes perez')
    // An existing name is not offered as new: the plain option opens it
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

// backend specs/0028: "+ Crear …" from the trip's lists
describe('creating from the lists', () => {
  // CA-1
  test('a driver typed and not found is created with that name and chosen', async () => {
    renderAt('/viajes/nuevo')
    await choose('Cliente', 'Transportes Pérez')
    await createFrom('Conductor', 'Zoila Mena')
    const dialog = await screen.findByRole('dialog', {
      name: 'Nuevo conductor',
    })
    expect(within(dialog).getByLabelText('Nombre del conductor')).toHaveValue(
      'Zoila Mena'
    )
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar conductor' })
    )
    await waitFor(() => {
      expect(fleetApi.createFleetItem).toHaveBeenCalledWith(
        'drivers',
        'new-client',
        'org-a',
        expect.objectContaining({ name: 'Zoila Mena' })
      )
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(screen.getByRole('combobox', { name: 'Conductor' })).toHaveValue(
      'Zoila Mena'
    )
    // What was filled before stays
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveValue(
      'Transportes Pérez'
    )
    expect(sileo.success).toHaveBeenCalledWith({ title: 'Conductor guardado' })
  })

  // CA-4
  test('a repeated driver is said in the dialog and not saved', async () => {
    renderAt('/viajes/nuevo')
    await createFrom('Conductor', 'Zoila')
    const dialog = await screen.findByRole('dialog', {
      name: 'Nuevo conductor',
    })
    fireEvent.change(within(dialog).getByLabelText('Nombre del conductor'), {
      target: { value: 'pedro ruiz' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar conductor' })
    )
    expect(
      await within(dialog).findByText('Ya existe un conductor con ese nombre')
    ).toBeInTheDocument()
    expect(fleetApi.createFleetItem).not.toHaveBeenCalled()
  })

  // CA-2
  test('a truck created is chosen', async () => {
    renderAt('/viajes/nuevo')
    await createFrom('Camión', 'Unidad 30')
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo camión' })
    expect(
      within(dialog).getByLabelText('Nombre o número de unidad')
    ).toHaveValue('Unidad 30')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar camión' })
    )
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Camión' })).toHaveValue(
        'Unidad 30'
      )
    })
    expect(fleetApi.createFleetItem).toHaveBeenCalledWith(
      'trucks',
      'new-client',
      'org-a',
      expect.objectContaining({ name: 'Unidad 30' })
    )
  })

  // CA-3
  test('a rate opens empty; created, it is chosen and brings its client', async () => {
    renderAt('/viajes/nuevo')
    await createFrom('Tarifa', 'León')
    const dialog = await screen.findByRole('dialog', { name: 'Nueva tarifa' })
    expect(within(dialog).getByLabelText('Origen')).toHaveValue('')
    fireEvent.change(within(dialog).getByLabelText('Origen'), {
      target: { value: 'Rivas' },
    })
    fireEvent.change(within(dialog).getByLabelText('Destino'), {
      target: { value: 'Managua' },
    })
    fireEvent.change(within(dialog).getByLabelText('Precio'), {
      target: { value: '7000' },
    })
    await choose('Cliente (opcional)', 'Fletes Ríos', dialog)
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar tarifa' })
    )
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(screen.getByRole('combobox', { name: 'Tarifa' })).toHaveValue(
      'Rivas - Managua - C$7,000.00'
    )
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveValue(
      'Fletes Ríos'
    )
    expect(screen.getByText('Ingresos: C$7,000.00 NIO')).toBeInTheDocument()
  })

  // specs/0031 RF-2, CA-1: a dialog over a dialog
  test("a rate's client is created from the rate's dialog", async () => {
    renderAt('/viajes/nuevo')
    await createFrom('Tarifa', 'Rivas')
    const dialog = await screen.findByRole('dialog', { name: 'Nueva tarifa' })
    fireEvent.change(within(dialog).getByLabelText('Origen'), {
      target: { value: 'Rivas' },
    })
    fireEvent.change(within(dialog).getByLabelText('Destino'), {
      target: { value: 'Managua' },
    })
    fireEvent.change(within(dialog).getByLabelText('Precio'), {
      target: { value: '7000' },
    })
    await createFrom('Cliente (opcional)', 'Acarreos del Norte')
    const clientDialog = await screen.findByRole('dialog', {
      name: 'Nuevo cliente',
    })
    fireEvent.click(
      within(clientDialog).getByRole('button', { name: 'Guardar cliente' })
    )
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Nuevo cliente' })).toBeNull()
    })
    // Back on the rate, as it was, with its client
    expect(within(dialog).getByLabelText('Origen')).toHaveValue('Rivas')
    expect(
      within(dialog).getByRole('combobox', { name: 'Cliente (opcional)' })
    ).toHaveValue('Acarreos del Norte')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar tarifa' })
    )
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveValue(
        'Acarreos del Norte'
      )
    })
    expect(screen.getByRole('combobox', { name: 'Tarifa' })).toHaveValue(
      'Rivas - Managua - C$7,000.00'
    )
  })

  test('cancelling changes nothing', async () => {
    renderAt('/viajes/nuevo')
    await createFrom('Remolque (opcional)', 'Caja 9')
    const dialog = await screen.findByRole('dialog', {
      name: 'Nuevo remolque',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(fleetApi.createFleetItem).not.toHaveBeenCalled()
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
    expect(
      screen.getByText('Aún no hay gastos en este viaje.')
    ).toBeInTheDocument()
    const first = await openDialog('Agregar gasto', 'Nuevo gasto')
    await choose('Categoría', 'Peajes', first)
    type('Monto', '1850', first)
    // In sight, not behind "Ver más detalles" (specs/0036)
    expect(within(first).getByLabelText('Descripción (opcional)')).toBeVisible()
    type('Descripción (opcional)', 'Peaje de Tipitapa', first)
    fireEvent.click(
      within(first).getByRole('button', { name: 'Ver más detalles' })
    )
    await choose('Conductor (opcional)', 'Marta Gómez', first)
    await saveDialog(first)
    const second = await openDialog('Agregar gasto', 'Nuevo gasto')
    await choose('Categoría', 'Viáticos', second)
    type('Monto', '600', second)
    await saveDialog(second)
    expect(
      screen.getByRole('button', { name: 'Gasto de Peajes, C$1,850.00 NIO' })
    ).toHaveTextContent('Conductor: Marta Gómez')
    expect(screen.getByText('Gastos: C$2,450.00 NIO')).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('region', { name: 'Resumen del viaje' })
      ).getByText('C$22,550.00 NIO')
    ).toBeInTheDocument()
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
                // Chosen in its dialog (specs/0029 RF-4)
                driverId: 'driver-2',
                driverName: 'Marta Gómez',
              },
            },
            {
              fields: { categoryName: 'Viáticos', amount: 600, driverId: null },
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

    const second = await screen.findByRole('button', {
      name: 'Gasto de Viáticos, C$1,350.00 NIO',
    })
    expect(
      within(second).getByTitle('Con foto del comprobante')
    ).toBeInTheDocument()
    expect(screen.getByText('Gastos: C$3,200.00 NIO')).toBeInTheDocument()
    removeFromMenu('Opciones del gasto de Peajes')
    expect(
      screen.queryByRole('button', { name: /^Gasto de Peajes/ })
    ).toBeNull()
    expect(screen.getByText('Gastos: C$1,350.00 NIO')).toBeInTheDocument()
    fireEvent.click(second)
    const dialog = screen.getByRole('dialog', { name: 'Editar gasto' })
    expect(within(dialog).getByLabelText('Monto')).toHaveValue('1,350')
    type('Monto', '1500', dialog)
    await saveDialog(dialog)
    expect(screen.getByText('Gastos: C$1,500.00 NIO')).toBeInTheDocument()
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

    const refuel = await screen.findByRole('button', {
      name: 'Relleno de Combustible, C$4,500.00 NIO',
    })
    expect(refuel).toHaveTextContent('Relleno de Tanque izquierdo')
    // CA-4: no menu, and tapping it says where it changes
    expect(
      screen.queryByRole('button', {
        name: 'Opciones del gasto de Combustible',
      })
    ).toBeNull()
    fireEvent.click(refuel)
    expect(sileo.info).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Se cambia en el relleno, en Historial.',
      })
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Gastos: C$6,350.00 NIO')).toBeInTheDocument()

    removeFromMenu('Opciones del gasto de Peajes')
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
    await choose('Tarifa', 'León - Managua - C$9,000.00')
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

  test('an expense needs its category and amount; cancelling adds none', async () => {
    renderAt('/viajes/nuevo')
    const dialog = await openDialog('Agregar gasto', 'Nuevo gasto')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(
      await within(dialog).findByText('Elige la categoría')
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Escribe el monto')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(
      screen.getByText('Aún no hay gastos en este viaje.')
    ).toBeInTheDocument()
    expect(tripsApi.saveTripWithExpenses).not.toHaveBeenCalled()
  })

  // specs/0029 CA-2: an income is edited by tapping it, removed from its menu
  test('an income is edited from its card and removed after asking', async () => {
    renderAt('/viajes/nuevo')
    await screen.findByRole('group', { name: '¿Cómo se calcula el precio?' })
    await choose('¿Cómo se calcula el precio?', 'Manual')
    type('Precio', '7000')
    const dialog = await openDialog('Agregar ingreso', 'Nuevo ingreso')
    type('Descripción', 'Parada en León', dialog)
    type('Monto', '1000', dialog)
    await saveDialog(dialog)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ingreso de Parada en León, C$1,000.00 NIO',
      })
    )
    const editing = screen.getByRole('dialog', { name: 'Editar ingreso' })
    type('Monto', '1200', editing)
    await saveDialog(editing)
    expect(screen.getByText('Ingresos: C$8,200.00 NIO')).toBeInTheDocument()

    removeFromMenu('Opciones del ingreso de Parada en León')
    expect(screen.getByText('Ingresos: C$7,000.00 NIO')).toBeInTheDocument()
  })

  // specs/0029 CA-5, CA-6
  test('each section says what to fix; a loss is said in the bar', async () => {
    renderAt('/viajes/nuevo')
    await screen.findByRole('group', { name: '¿Cómo se calcula el precio?' })
    await choose('¿Cómo se calcula el precio?', 'Manual')
    type('Origen', 'Managua')
    type('Destino', 'León')
    type('Precio', '1000')
    const dialog = await openDialog('Agregar gasto', 'Nuevo gasto')
    await choose('Categoría', 'Peajes', dialog)
    type('Monto', '1500', dialog)
    await saveDialog(dialog)
    const summary = screen.getByRole('region', { name: 'Resumen del viaje' })
    expect(within(summary).getByText('-C$500.00 NIO')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar viaje' }))
    expect(
      await within(
        screen.getByRole('region', { name: 'Cliente y precio' })
      ).findByText('1 dato por revisar')
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('region', { name: 'Camión y conductores' })
      ).getByText('2 datos por revisar')
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Gastos' })).queryByText(
        /por revisar/
      )
    ).toBeNull()
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

  // Audit 0027: just edited, the backend moves its expenses a moment later;
  // the screen reads them again until they go with the trip
  test('an expense the backend is moving is read again until it settles', async () => {
    tripsApi.readTrip.mockResolvedValue(trip({ truckId: 'truck-2' }))
    expensesApi.readTripExpenses
      .mockResolvedValueOnce([
        expense({ id: 'r1', refuelId: 'r1', description: 'Relleno de Tanque' }),
      ])
      .mockResolvedValue([])
    renderAt('/viajes/trip-1')

    const section = await screen.findByRole('region', { name: 'Gastos' })
    expect(
      await within(section).findByText(/Relleno de Tanque/)
    ).toBeInTheDocument()
    expect(
      await within(section).findByText(
        'Este viaje no tiene gastos.',
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument()
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

describe('audit of the trip form (2026-10-09)', () => {
  // An expense in another currency was shown and summed as the trip's
  test("an expense in another currency keeps it, out of the trip's total", async () => {
    tripsApi.readTrip.mockResolvedValue(trip())
    expensesApi.readTripExpenses.mockResolvedValue([
      expense(),
      expense({ id: 'expense-2', currency: 'USD', amount: 100 }),
    ])
    renderAt('/viajes/trip-1/editar')

    expect(
      await screen.findByRole('button', { name: /^Gasto de Peajes, .*USD$/ })
    ).toBeInTheDocument()
    expect(screen.getByText('Gastos: C$1,850.00 NIO')).toBeInTheDocument()
  })

  // A refused save left a trip that was never saved, and its expenses
  test('a refused save leaves nothing that was not saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    tripsApi.saveTripWithExpenses.mockRejectedValueOnce(
      Object.assign(new Error('denied'), { code: 'invalid-argument' })
    )
    renderAt('/viajes/nuevo')
    await choose('Cliente', 'Transportes Pérez')
    await choose('Tarifa', 'Managua - San José - C$25,000.00')
    await choose('Camión', 'Unidad 12')
    const row = await openDialog('Agregar gasto', 'Nuevo gasto')
    await choose('Categoría', 'Peajes', row)
    type('Monto', '1850', row)
    await saveDialog(row)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar viaje' }))

    await waitFor(() => {
      expect(sileo.error).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'No pudimos guardar el viaje' })
      )
    })
    expect(useTripsStore.getState().known['new-trip']).toBeUndefined()
    expect(useExpensesStore.getState().known['new-expense']).toBeUndefined()
  })

  // "+ Crear viaje" from a refuel brought the truck alone
  test('a preset truck brings its trailer and driver', async () => {
    await useFleetStore.getState().load('org-a')
    render(
      <TripForm
        trip={null}
        expenses={[]}
        id="new-trip"
        orgId="org-a"
        currency="NIO"
        preset={{ truckId: 'truck-1' }}
        onSaved={() => undefined}
      />
    )
    await choose('Cliente', 'Transportes Pérez')
    await choose('Tarifa', 'Managua - San José - C$25,000.00')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar viaje' }))

    await waitFor(() => {
      expect(tripsApi.saveTripWithExpenses).toHaveBeenCalledWith(
        'new-trip',
        'org-a',
        expect.objectContaining({
          truckId: 'truck-1',
          trailerId: 'trailer-1',
          driverId: 'driver-1',
        }),
        true,
        expect.anything()
      )
    })
  })

  // The limit counted every row: a trip with 10 could not get one more
  test('a trip with 10 expenses can still add one', async () => {
    tripsApi.readTrip.mockResolvedValue(trip())
    expensesApi.readTripExpenses.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) =>
        expense({ id: `expense-${String(index)}` })
      )
    )
    renderAt('/viajes/trip-1/editar')

    expect(
      await screen.findByRole('button', { name: 'Agregar gasto' })
    ).toBeInTheDocument()
  })
})

// backend specs/0037
describe('its documents', () => {
  const tripDocument = (
    overrides: Partial<TripDocument> = {}
  ): TripDocument => ({
    id: 'd1',
    orgId: 'org-a',
    tripId: 'trip-1',
    name: 'Factura 1234',
    contentType: 'application/pdf',
    size: 1.2 * 1024 * 1024,
    path: 'orgs/org-a/trips/trip-1/documents/d1.pdf',
    createdAt: new Date(2026, 9, 9, 14, 32),
    createdBy: 'luis',
    ...overrides,
  })
  const photo = tripDocument({
    id: 'd2',
    name: 'Carta de porte',
    contentType: 'image/jpeg',
    size: 300 * 1024,
    path: 'orgs/org-a/trips/trip-1/documents/d2.jpg',
    createdBy: 'ana',
  })
  const revokeObjectURL = vi.fn()
  const choose = (input: string, file: File) => {
    fireEvent.change(screen.getByLabelText(input), {
      target: { files: [file] },
    })
  }

  beforeEach(() => {
    tripsApi.readTrip.mockResolvedValue(trip())
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = revokeObjectURL
  })

  // CA-1, CA-2 (RF-9, RF-12)
  test('a PDF opens in another tab, a photo full screen', async () => {
    documentsApi.readTripDocuments.mockResolvedValue([tripDocument(), photo])
    renderAt('/viajes/trip-1')

    const section = await screen.findByRole('region', {
      name: 'Documentos (2)',
    })
    const pdf = await within(section).findByRole('link', {
      name: 'PDF: Factura 1234',
    })
    expect(pdf).toHaveAttribute('href', 'https://files.test/document')
    expect(pdf).toHaveAttribute('target', '_blank')
    expect(pdf).toHaveTextContent('Subido por ti')
    expect(pdf).toHaveTextContent('9 oct 2026, 14:32 · 1.2 MB')
    const card = await within(section).findByRole('button', {
      name: 'Foto: Carta de porte',
    })
    expect(card).toHaveTextContent('Subido por Ana López')
    fireEvent.click(card)
    expect(
      within(screen.getByRole('dialog', { name: 'Carta de porte' })).getByRole(
        'img',
        { name: 'Carta de porte' }
      )
    ).toBeInTheDocument()
  })

  // CA-2 (RF-10)
  test('a PDF of the phone is named as its file, and uploaded', async () => {
    documentsApi.uploadTripDocument.mockImplementation(
      (input: { name: string }) =>
        Promise.resolve(tripDocument({ id: 'new-document', name: input.name }))
    )
    renderAt('/viajes/trip-1')
    expect(
      await screen.findByText('Aún no hay documentos en este viaje.')
    ).toBeInTheDocument()

    choose(
      'Archivo del teléfono',
      new File(['%PDF'], 'Guía 77.pdf', { type: 'application/pdf' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Nuevo documento' })
    expect(within(dialog).getByLabelText('Nombre')).toHaveValue('Guía 77')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Subir' }))

    await waitFor(() => {
      expect(sileo.success).toHaveBeenCalledWith({ title: 'Documento subido' })
    })
    expect(documentsApi.uploadTripDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-a',
        tripId: 'trip-1',
        id: 'new-document',
        name: 'Guía 77',
        kind: 'pdf',
      }),
      expect.any(Function)
    )
    expect(
      await screen.findByRole('link', { name: 'PDF: Guía 77' })
    ).toBeInTheDocument()
  })

  // CA-1 (RF-10): a photo of the camera is named by its moment
  test('a photo of the camera shows before uploading', async () => {
    renderAt('/viajes/trip-1')
    await screen.findByText('Aún no hay documentos en este viaje.')

    choose(
      'Foto de la cámara',
      new File(['jpeg'], 'image.jpg', { type: 'image/jpeg' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Nuevo documento' })
    expect(
      within(dialog).getByRole('img', { name: 'Vista previa' })
    ).toHaveAttribute('src', 'blob:preview')
    expect(
      within(dialog).getByLabelText<HTMLInputElement>('Nombre').value
    ).toMatch(/^Foto del /)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview')
    expect(documentsApi.uploadTripDocument).not.toHaveBeenCalled()
  })

  // CA-3 (RF-11)
  test('what cannot be uploaded says why', async () => {
    documentsApi.readTripDocuments.mockResolvedValue(
      Array.from({ length: 30 }, (_, index) =>
        tripDocument({ id: `d${String(index)}`, name: `Doc ${String(index)}` })
      )
    )
    renderAt('/viajes/trip-1')
    await screen.findByRole('region', { name: 'Documentos (30)' })

    choose(
      'Archivo del teléfono',
      new File(['x'], 'a.pdf', { type: 'application/pdf' })
    )
    expect(sileo.warning).toHaveBeenLastCalledWith({
      title: 'Este viaje ya tiene 30 documentos.',
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('another format, a big PDF or no signal: nothing is uploaded', async () => {
    renderAt('/viajes/trip-1')
    await screen.findByText('Aún no hay documentos en este viaje.')

    choose(
      'Archivo del teléfono',
      new File(['x'], 'a.docx', { type: 'text/plain' })
    )
    expect(sileo.warning).toHaveBeenLastCalledWith({
      title: 'Solo se aceptan fotos y PDF.',
    })
    choose(
      'Archivo del teléfono',
      new File([new Uint8Array(11 * 1024 * 1024)], 'big.pdf', {
        type: 'application/pdf',
      })
    )
    expect(sileo.warning).toHaveBeenLastCalledWith({
      title: 'El PDF pesa más de 10 MB.',
    })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    choose(
      'Archivo del teléfono',
      new File(['x'], 'a.pdf', { type: 'application/pdf' })
    )
    expect(sileo.warning).toHaveBeenLastCalledWith({
      title: 'Necesitas conexión para subir el documento.',
    })
    vi.restoreAllMocks()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // CA-4 (RF-4, RF-12)
  test("a driver renames and deletes theirs, not the others'", async () => {
    signIn('driver')
    documentsApi.readTripDocuments.mockResolvedValue([tripDocument(), photo])
    renderAt('/viajes/trip-1')
    await screen.findByRole('region', { name: 'Documentos (2)' })

    expect(
      screen.queryByRole('button', {
        name: 'Opciones del documento Carta de porte',
      })
    ).toBeNull()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Opciones del documento Factura 1234',
      })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Renombrar' }))
    const dialog = screen.getByRole('dialog', { name: 'Renombrar documento' })
    fireEvent.change(within(dialog).getByLabelText('Nombre'), {
      target: { value: 'Factura 99' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(documentsApi.renameTripDocument).toHaveBeenCalledWith(
        'd1',
        'Factura 99'
      )
    })
    expect(
      await screen.findByRole('link', { name: 'PDF: Factura 99' })
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Opciones del documento Factura 99' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Borrar' }))
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: '¿Borrar Factura 99?' })
      ).getByRole('button', { name: 'Borrar' })
    )
    await waitFor(() => {
      expect(documentsApi.deleteTripDocument).toHaveBeenCalledWith('d1')
    })
    expect(screen.queryByRole('link', { name: 'PDF: Factura 99' })).toBeNull()
  })

  test('a viewer opens them, without adding or changing', async () => {
    signIn('viewer')
    documentsApi.readTripDocuments.mockResolvedValue([tripDocument()])
    renderAt('/viajes/trip-1')

    expect(
      await screen.findByRole('link', { name: 'PDF: Factura 1234' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tomar foto' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Subir archivo' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: /^Opciones del documento/ })
    ).toBeNull()
  })

  // CA-5 (RF-13)
  test('deleting the trip says its documents go too', async () => {
    documentsApi.readTripDocuments.mockResolvedValue([tripDocument(), photo])
    renderAt('/viajes/trip-1')
    await screen.findByRole('region', { name: 'Documentos (2)' })

    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(
      await screen.findByText(
        'Sus 2 documentos también se borrarán. No se puede deshacer.',
        { exact: false }
      )
    ).toBeInTheDocument()
  })
})
