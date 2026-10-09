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
  trailer,
  trip,
  truck,
} from '../../testing/fleetFixtures'
import { choose } from '../../testing/choose'
import { filterBy } from '../../testing/filterBy'

const fleetApi = vi.hoisted(() => ({
  readFleet: vi.fn(),
  readMembers: vi.fn(() => Promise.resolve([])),
  photoUrl: vi.fn(() => Promise.resolve('blob:receipt')),
  newFleetId: vi.fn(() => 'new-truck'),
  createFleetItem: vi.fn(() => Promise.resolve()),
}))
vi.mock('services/fleet', () => fleetApi)

const tripsApi = vi.hoisted(() => ({
  readTripsInPeriod: vi.fn(),
  readTrip: vi.fn(),
  // "+ Crear viaje" (specs/0031 RF-3)
  newTripId: vi.fn(() => 'new-trip'),
  saveTripWithExpenses: vi.fn(() => Promise.resolve()),
}))
vi.mock('services/trips', () => tripsApi)

const expensesApi = vi.hoisted(() => ({
  newExpenseId: vi.fn(() => 'new-expense'),
  readCategories: vi.fn(),
  seedCategories: vi.fn(),
  createCategory: vi.fn(() => Promise.resolve()),
  updateCategory: vi.fn(() => Promise.resolve()),
  readExpensesInPeriod: vi.fn(),
  readTripExpenses: vi.fn(() => Promise.resolve([])),
  readExpense: vi.fn(),
  createExpense: vi.fn(() => Promise.resolve()),
  updateExpense: vi.fn(() => Promise.resolve()),
  deleteExpense: vi.fn(() => Promise.resolve()),
  uploadReceipt: vi.fn(),
  readRefuelOfExpense: vi.fn(),
  updateRefuelExpense: vi.fn(() => Promise.resolve()),
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
  fleetApi.readFleet.mockResolvedValue({
    clients: [],
    trucks: [truck(), truck({ id: 'truck-2', name: 'Unidad 15' })],
    trailers: [trailer()],
    tanks: [],
    drivers: [driver()],
    rates: [],
  })
  tripsApi.readTripsInPeriod.mockResolvedValue({
    items: [trip()],
    truncated: false,
  })
  tripsApi.readTrip.mockResolvedValue(trip())
  expensesApi.readCategories.mockResolvedValue(presetCategories())
  expensesApi.readExpensesInPeriod.mockResolvedValue({
    items: [
      expense({ id: 'e1', amount: 1850, takenAt: new Date(2026, 9, 6, 12) }),
      expense({
        id: 'e2',
        kind: 'truck',
        tripId: null,
        tripRoute: null,
        trailerId: null,
        trailerName: null,
        categoryId: 'org-a_fuel',
        categoryName: 'Combustible',
        amount: 25000,
        takenAt: new Date(2026, 9, 5, 9),
      }),
      expense({
        id: 'e3',
        kind: 'general',
        tripId: null,
        tripRoute: null,
        truckId: null,
        truckName: null,
        trailerId: null,
        trailerName: null,
        categoryId: 'org-a_parking',
        categoryName: 'Parqueo',
        amount: 300,
        description: 'Parqueo del patio',
        takenAt: new Date(2026, 9, 4, 9),
      }),
      expense({
        id: 'e4',
        kind: 'truck',
        tripId: null,
        tripRoute: null,
        truckId: 'truck-2',
        truckName: 'Unidad 15',
        trailerId: null,
        trailerName: null,
        categoryId: 'org-a_fuel',
        categoryName: 'Combustible',
        amount: 15000,
        takenAt: new Date(2026, 9, 3, 9),
      }),
    ],
    truncated: false,
  })
  expensesApi.readExpense.mockResolvedValue(null)
  signIn()
})

afterEach(() => {
  vi.clearAllMocks()
})

// backend specs/0026 RF-8
test('with a session the bar has Gastos, active on its page', async () => {
  renderAt('/gastos')
  const nav = await screen.findByRole('navigation', { name: 'Secciones' })
  expect(
    within(nav)
      .getAllByRole('link')
      .map(link => link.textContent)
  ).toEqual(['Historial', 'Medición', 'Flota', 'Viajes', 'Gastos'])
  expect(within(nav).getByRole('link', { name: 'Gastos' })).toHaveAttribute(
    'aria-current',
    'page'
  )
})

// RF-9, CA-6
describe('the list', () => {
  test('the totals add up by category, largest first', async () => {
    renderAt('/gastos')

    const totals = await screen.findByRole('status', {
      name: 'Totales del periodo',
    })
    expect(totals).toHaveTextContent('4 gastos · C$42,150.00 NIO')
    expect(
      within(totals)
        .getAllByRole('term')
        .map(term => term.textContent)
    ).toEqual(['Combustible', 'Peajes', 'Parqueo'])
    expect(totals).toHaveTextContent('CombustibleC$40,000.00 NIO')

    const cards = within(
      screen.getByRole('list', { name: 'Gastos' })
    ).getAllByRole('button')
    expect(cards[0]).toHaveAccessibleName('Gasto de Peajes, C$1,850.00 NIO')
    expect(cards[0]).toHaveTextContent('Viaje Managua → San José')
    expect(cards[1]).toHaveTextContent('Camión Unidad 12')
    expect(cards[2]).toHaveTextContent('General')
    expect(cards[2]).toHaveTextContent('Parqueo del patio')
    // The current month by default
    expect(expensesApi.readExpensesInPeriod).toHaveBeenCalledWith(
      'org-a',
      expect.any(Date),
      expect.any(Date)
    )
  })

  test('"Corresponde a → General" leaves the general ones', async () => {
    renderAt('/gastos')
    await screen.findByRole('list', { name: 'Gastos' })

    await filterBy('Corresponde a', 'General')
    expect(
      screen.getByRole('status', { name: 'Totales de lo filtrado' })
    ).toHaveTextContent('1 gasto · C$300.00 NIO')
  })

  test('a truck counts the expenses of its trips', async () => {
    renderAt('/gastos')
    await screen.findByRole('list', { name: 'Gastos' })

    await filterBy('Camión', 'Unidad 12')
    expect(
      screen.getByRole('status', { name: 'Totales de lo filtrado' })
    ).toHaveTextContent('2 gastos · C$26,850.00 NIO')
  })

  test('a category shows its current name', async () => {
    expensesApi.readCategories.mockResolvedValue(
      presetCategories().map(category =>
        category.id === 'org-a_tolls'
          ? { ...category, name: 'Peajes y puentes' }
          : category
      )
    )
    renderAt('/gastos')
    expect(
      await screen.findByRole('button', {
        name: 'Gasto de Peajes y puentes, C$1,850.00 NIO',
      })
    ).toBeInTheDocument()
  })

  test('an empty period invites to add one; a viewer sees no "Agregar"', async () => {
    expensesApi.readExpensesInPeriod.mockResolvedValue({
      items: [],
      truncated: false,
    })
    renderAt('/gastos')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Agregar gasto' })
    )
    expect(window.location.pathname).toBe('/gastos/nuevo')
  })

  test('a viewer reads the list without adding', async () => {
    signIn('viewer')
    renderAt('/gastos')
    await screen.findByRole('list', { name: 'Gastos' })
    expect(screen.queryByRole('button', { name: 'Agregar' })).toBeNull()
  })
})

// RF-10
describe('the form', () => {
  // CA-2
  test('a truck expense: no trip, no trailer', async () => {
    signIn('driver')
    renderAt('/gastos/nuevo')

    await screen.findByLabelText('Monto')
    type('Monto', '1850')
    await choose('Categoría', 'Peajes')
    await choose('Camión', 'Unidad 12')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(() => {
      expect(expensesApi.createExpense).toHaveBeenCalledWith(
        'new-expense',
        'org-a',
        expect.objectContaining({
          kind: 'truck',
          amount: 1850,
          currency: 'NIO',
          categoryId: 'org-a_tolls',
          categoryName: 'Peajes',
          truckId: 'truck-1',
          truckName: 'Unidad 12',
          tripId: null,
          trailerId: null,
          receiptPhotoPath: null,
        })
      )
    })
    expect(sileo.success).toHaveBeenCalledWith({ title: 'Gasto guardado' })
    expect(window.location.pathname).toBe('/gastos')
  })

  test('from a trip: "Viaje" and that trip come chosen', async () => {
    renderAt('/gastos/nuevo?viaje=trip-1')

    await screen.findByLabelText('Monto')
    type('Monto', '500')
    await choose('Categoría', 'Viáticos')
    expect(
      screen.getByRole('combobox', { name: /^Corresponde a/ })
    ).toHaveTextContent('Viaje')
    expect(screen.getByRole('combobox', { name: 'Viaje' })).toHaveValue(
      'mar 6 oct · Managua → San José · Transportes Pérez'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(() => {
      expect(expensesApi.createExpense).toHaveBeenCalledWith(
        'new-expense',
        'org-a',
        expect.objectContaining({
          kind: 'trip',
          tripId: 'trip-1',
          tripRoute: 'Managua → San José',
          truckId: 'truck-1',
          trailerId: 'trailer-1',
        })
      )
    })
    // Back to the trip it came from
    expect(window.location.pathname).toBe('/viajes/trip-1')
  })

  test('a new one needs its amount and category', async () => {
    renderAt('/gastos/nuevo')
    await screen.findByLabelText('Monto')
    await choose('Corresponde a', 'General')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))
    expect(await screen.findByText('Escribe el monto')).toBeInTheDocument()
    expect(screen.getByText('Elige la categoría')).toBeInTheDocument()
    expect(expensesApi.createExpense).not.toHaveBeenCalled()
  })

  test('a saved one shows its receipt and is deleted after asking', async () => {
    expensesApi.readExpense.mockResolvedValue(
      expense({ receiptPhotoPath: 'orgs/org-a/expenses/expense-1/receipt.jpg' })
    )
    renderAt('/gastos/expense-1')

    expect(
      await screen.findByRole('img', { name: 'Foto del comprobante' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    const dialog = await screen.findByRole('dialog', {
      name: '¿Borrar este gasto?',
    })
    expect(dialog).toHaveTextContent('No se puede deshacer.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Borrar' }))

    await waitFor(() => {
      expect(expensesApi.deleteExpense).toHaveBeenCalledWith('expense-1')
    })
    expect(sileo.success).toHaveBeenCalledWith({ title: 'Gasto borrado' })
    expect(window.location.pathname).toBe('/gastos')
  })

  test('a viewer sees it without editing', async () => {
    signIn('viewer')
    expensesApi.readExpense.mockResolvedValue(expense())
    renderAt('/gastos/expense-1')

    expect(await screen.findByLabelText('Monto')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull()
  })
})

// RF-11, CA-1
describe('the categories', () => {
  test('an organization without any gets the nine presets', async () => {
    expensesApi.readCategories.mockResolvedValue([])
    expensesApi.seedCategories.mockResolvedValue(presetCategories())
    renderAt('/gastos/categorias')

    const list = await screen.findByRole('list', { name: 'Categorías' })
    expect(expensesApi.seedCategories).toHaveBeenCalledWith('org-a')
    expect(
      within(list)
        .getAllByRole('heading')
        .map(heading => heading.textContent)
    ).toEqual([
      'Combustible',
      'Llantas',
      'Mantenimiento correctivo',
      'Mantenimiento preventivo',
      'Pago del conductor',
      'Parqueo',
      'Peajes',
      'Repuestos',
      'Viáticos',
    ])
    // Fuel is the refuels': it is not archived
    expect(list).toHaveTextContent('La usan los rellenos')
    expect(
      screen.queryByRole('button', { name: 'Archivar Combustible' })
    ).toBeNull()
  })

  test('adding one checks the name is not taken', async () => {
    renderAt('/gastos/categorias')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Agregar categoría' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Nueva categoría',
    })
    fireEvent.change(within(dialog).getByLabelText('Nombre'), {
      target: { value: 'viaticos' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(
      await within(dialog).findByText('Ya existe una categoría con ese nombre')
    ).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Nombre'), {
      target: { value: 'Lavado' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(expensesApi.createCategory).toHaveBeenCalledWith(
        'new-expense',
        'org-a',
        'Lavado'
      )
    })
    expect(
      await screen.findByRole('heading', { name: 'Lavado' })
    ).toBeInTheDocument()
  })

  test('renaming and archiving; Archivadas shows it to restore', async () => {
    renderAt('/gastos/categorias')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Renombrar Peajes' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Renombrar categoría',
    })
    fireEvent.change(within(dialog).getByLabelText('Nombre'), {
      target: { value: 'Peajes y puentes' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(expensesApi.updateCategory).toHaveBeenCalledWith('org-a_tolls', {
        name: 'Peajes y puentes',
      })
    })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Archivar Llantas' })
    )
    expect(expensesApi.updateCategory).toHaveBeenCalledWith('org-a_tires', {
      archived: true,
    })
    expect(screen.queryByRole('heading', { name: 'Llantas' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Archivadas' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Restaurar Llantas' })
    )
    expect(expensesApi.updateCategory).toHaveBeenCalledWith('org-a_tires', {
      archived: false,
    })
  })
})

// backend specs/0027 RF-9, RF-10, CA-4
describe("a refuel's expense", () => {
  const refuelExpense = expense({
    id: 'r1',
    refuelId: 'r1',
    kind: 'truck',
    tripId: null,
    tripRoute: null,
    trailerId: null,
    trailerName: null,
    categoryId: 'org-a_fuel',
    categoryName: 'Combustible',
    amount: 4500,
    description: 'Relleno de Tanque izquierdo',
    takenAt: new Date(2026, 9, 6, 12),
  })

  beforeEach(() => {
    expensesApi.readExpense.mockResolvedValue(refuelExpense)
    expensesApi.readRefuelOfExpense.mockResolvedValue({
      tankName: 'Tanque izquierdo',
      equipment: { kind: 'truck', id: 'truck-1' },
    })
    tripsApi.readTripsInPeriod.mockResolvedValue({
      items: [
        trip(),
        trip({
          id: 'trip-2',
          truckId: 'truck-2',
          truckName: 'Unidad 15',
          origin: 'León',
          destination: 'Managua',
        }),
      ],
      truncated: false,
    })
  })

  test('in the list it says "Relleno"', async () => {
    expensesApi.readExpensesInPeriod.mockResolvedValue({
      items: [refuelExpense],
      truncated: false,
    })
    renderAt('/gastos')
    const card = await screen.findByRole('button', {
      name: 'Relleno de Combustible, C$4,500.00 NIO',
    })
    expect(card).toHaveTextContent('Relleno')
  })

  test('only its link and description change, to a trip of its truck', async () => {
    renderAt('/gastos/r1')

    expect(
      await screen.findByText(
        'Este gasto es de un relleno de Tanque izquierdo. El monto, la fecha y la categoría se cambian en el relleno, en Historial.'
      )
    ).toBeInTheDocument()
    // Shown, not edited; and it is not deleted here
    expect(screen.getByText('C$4,500.00 NIO')).toBeInTheDocument()
    expect(screen.queryByLabelText('Monto')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull()

    await choose('Corresponde a', 'Viaje')
    const field = screen.getByRole('combobox', { name: 'Viaje' })
    fireEvent.mouseDown(field)
    // The trip of another truck is not offered
    expect(
      (await screen.findAllByRole('option')).map(option => option.textContent)
    ).toEqual([
      // specs/0031 RF-3
      '+ Crear viaje',
      'mar 6 oct · Managua → San José · Transportes Pérez',
    ])
    fireEvent.click(
      screen.getByRole('option', {
        name: 'mar 6 oct · Managua → San José · Transportes Pérez',
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(expensesApi.updateRefuelExpense).toHaveBeenCalledWith('r1', {
        kind: 'trip',
        tripId: 'trip-1',
        tripRoute: 'Managua → San José',
        truckId: 'truck-1',
        truckName: 'Unidad 12',
        trailerId: 'trailer-1',
        trailerName: 'Caja 7',
        description: 'Relleno de Tanque izquierdo',
      })
    })
    expect(sileo.success).toHaveBeenCalledWith({ title: 'Gasto guardado' })
  })

  test('back from a trip to its truck', async () => {
    expensesApi.readExpense.mockResolvedValue({
      ...refuelExpense,
      kind: 'trip',
      tripId: 'trip-1',
      tripRoute: 'Managua → San José',
    })
    renderAt('/gastos/r1')
    await screen.findByText(/Este gasto es de un relleno/)
    await choose('Corresponde a', 'Camión')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Guardar cambios' })
    )
    await waitFor(() => {
      expect(expensesApi.updateRefuelExpense).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({
          kind: 'truck',
          tripId: null,
          truckId: 'truck-1',
          truckName: 'Unidad 12',
          trailerId: null,
        })
      )
    })
  })
})

// backend specs/0028 CA-6: "+ Crear …" from the expense's lists
describe('creating from the lists', () => {
  const createFrom = async (label: string, text: string) => {
    const field = await screen.findByRole('combobox', {
      name: new RegExp(`^${label}`),
    })
    field.focus()
    fireEvent.change(field, { target: { value: text } })
    fireEvent.click(await screen.findByRole('option', { name: /^\+ Crear/ }))
  }

  test('a category typed is created and chosen', async () => {
    renderAt('/gastos/nuevo')
    await createFrom('Categoría', 'Lavado')
    const dialog = await screen.findByRole('dialog', {
      name: 'Nueva categoría',
    })
    expect(within(dialog).getByLabelText('Nombre')).toHaveValue('Lavado')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(expensesApi.createCategory).toHaveBeenCalledWith(
        'new-expense',
        'org-a',
        'Lavado'
      )
    })
    expect(screen.getByRole('combobox', { name: 'Categoría' })).toHaveValue(
      'Lavado'
    )
  })

  test('a truck created is chosen', async () => {
    renderAt('/gastos/nuevo')
    await createFrom('Camión', 'Unidad 30')
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo camión' })
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
      'new-truck',
      'org-a',
      expect.objectContaining({ name: 'Unidad 30' })
    )
  })
})

// backend specs/0031 RF-3: a trip created from the expense, full screen
describe('creating its trip', () => {
  beforeEach(() => {
    fleetApi.readFleet.mockResolvedValue({
      clients: [client()],
      trucks: [truck(), truck({ id: 'truck-2', name: 'Unidad 15' })],
      trailers: [trailer()],
      tanks: [],
      drivers: [driver()],
      rates: [],
    })
  })

  const openTripDialog = async () => {
    fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Viaje' }))
    fireEvent.click(
      await screen.findByRole('option', { name: '+ Crear viaje' })
    )
    return screen.findByRole('dialog', { name: 'Nuevo viaje' })
  }

  const fillTrip = async (dialog: HTMLElement) => {
    await choose('Cliente', 'Transportes Pérez', dialog)
    await choose('¿Cómo se calcula el precio?', 'Manual', dialog)
    for (const [label, value] of [
      ['Origen', 'Managua'],
      ['Destino', 'León'],
      ['Precio', '9000'],
    ] as const) {
      fireEvent.change(within(dialog).getByLabelText(label), {
        target: { value },
      })
    }
    await choose('Conductor', 'Pedro Ruiz', dialog)
  }

  // CA-4
  test('saved, it is chosen and the expense keeps what was written', async () => {
    renderAt('/gastos/nuevo')
    await choose('Categoría', 'Peajes')
    type('Monto', '350')
    await choose('Corresponde a', 'Viaje')
    const dialog = await openTripDialog()
    await fillTrip(dialog)
    await choose('Camión', 'Unidad 12', dialog)
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar viaje' })
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(tripsApi.saveTripWithExpenses).toHaveBeenCalledWith(
      'new-trip',
      'org-a',
      expect.objectContaining({ origin: 'Managua', destination: 'León' }),
      true,
      expect.anything()
    )
    expect(
      screen.getByRole<HTMLInputElement>('combobox', { name: 'Viaje' }).value
    ).toContain('Managua → León')
    // Still on the expense, as it was
    expect(window.location.pathname).toBe('/gastos/nuevo')
    expect(screen.getByLabelText('Monto')).toHaveValue('350')

    fireEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))
    await waitFor(() => {
      expect(expensesApi.createExpense).toHaveBeenCalledWith(
        'new-expense',
        'org-a',
        expect.objectContaining({ kind: 'trip', tripId: 'new-trip' })
      )
    })
  })

  test('closing with something written asks first', async () => {
    renderAt('/gastos/nuevo')
    await choose('Corresponde a', 'Viaje')
    const dialog = await openTripDialog()
    await choose('Cliente', 'Transportes Pérez', dialog)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
    fireEvent.click(
      within(
        await screen.findByRole('dialog', { name: '¿Descartar el viaje?' })
      ).getByRole('button', { name: 'Descartar' })
    )
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(tripsApi.saveTripWithExpenses).not.toHaveBeenCalled()
  })

  // CA-5
  test("a refuel's trip opens with its truck and is chosen", async () => {
    expensesApi.readExpense.mockResolvedValue(
      expense({
        id: 'r1',
        refuelId: 'r1',
        kind: 'truck',
        tripId: null,
        tripRoute: null,
        categoryId: 'org-a_fuel',
        categoryName: 'Combustible',
        amount: 4500,
        takenAt: new Date(2026, 9, 6, 12),
      })
    )
    expensesApi.readRefuelOfExpense.mockResolvedValue({
      tankName: 'Tanque izquierdo',
      equipment: { kind: 'truck', id: 'truck-2' },
    })
    renderAt('/gastos/r1')
    await screen.findByRole('group', { name: 'Corresponde a' })
    await choose('Corresponde a', 'Viaje')
    const dialog = await openTripDialog()
    expect(
      within(dialog).getByRole('combobox', { name: 'Camión' })
    ).toHaveValue('Unidad 15')
    await fillTrip(dialog)
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar viaje' })
    )
    await waitFor(() => {
      expect(
        screen.getByRole<HTMLInputElement>('combobox', { name: 'Viaje' }).value
      ).toContain('Managua → León')
    })
  })
})
