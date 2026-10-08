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
}))
vi.mock('services/fleet', () => fleetApi)

const tripsApi = vi.hoisted(() => ({
  readTripsInPeriod: vi.fn(),
  readTrip: vi.fn(),
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
