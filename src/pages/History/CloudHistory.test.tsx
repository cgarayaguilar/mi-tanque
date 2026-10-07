import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import { canChange } from 'pages/History/CloudHistory'
import { useCloudHistoryStore } from 'store/cloudHistory'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import type { Role } from 'utils/roles'
import {
  accountWithRole,
  cloudMeasurement,
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

const historyApi = vi.hoisted(() => ({
  HISTORY_PAGE_SIZE: 100,
  readHistoryPage: vi.fn(),
  updateCloudMeasurement: vi.fn(() => Promise.resolve()),
  deleteCloudMeasurement: vi.fn(() => Promise.resolve()),
}))
vi.mock('services/cloudMeasurements', () => historyApi)

const HOUR = 3_600_000

const signIn = (role: Role = 'owner') => {
  useSessionStore.setState({
    status: 'ready',
    user: { uid: 'luis', displayName: 'Luis', email: null, phoneNumber: null },
    ...accountWithRole(role),
    start: () => Promise.resolve(),
  })
}

const renderHistory = () => {
  window.history.pushState({}, '', '/history')
  render(<App />)
}

beforeEach(() => {
  useFleetStore.getState().reset()
  useCloudHistoryStore.getState().reset()
  fleetApi.readFleet.mockResolvedValue({
    trucks: [truck()],
    trailers: [trailer()],
    tanks: [
      tank(),
      tank({
        id: 'tank-2',
        name: 'Tanque de 50',
        shape: 'cylinder',
        dimensions: { diameterIn: 25, lengthIn: 26 },
        capacityGal: 50,
        equipment: { kind: 'none', id: null },
      }),
    ],
  })
  historyApi.readHistoryPage.mockResolvedValue({
    items: [
      cloudMeasurement({
        id: 'm-2',
        gallons: 60,
        takenAt: new Date(2026, 8, 30, 18),
      }),
      cloudMeasurement(),
    ],
    cursor: null,
  })
  signIn()
})

afterEach(() => {
  vi.clearAllMocks()
})

test('measurements are grouped by tank with author, city, estimate and odometer (CA-6)', async () => {
  historyApi.readHistoryPage.mockResolvedValue({
    items: [
      cloudMeasurement(),
      cloudMeasurement({
        id: 'm-3',
        tankId: 'tank-2',
        tankName: 'Tanque de 50',
        equipment: { kind: 'none', id: null, name: null },
        userName: 'Ana',
        location: null,
        place: null,
        placeStatus: null,
        estimate: null,
        odometerKm: null,
      }),
    ],
    cursor: null,
  })
  renderHistory()

  const first = await screen.findByRole('article', { name: 'Tanque izquierdo' })
  expect(first).toHaveTextContent('Unidad 12 · 1 medición')
  fireEvent.click(within(first).getByRole('button', { name: 'Ver 1 medición' }))
  const row = within(first).getByRole('listitem')
  expect(row).toHaveTextContent('Luis')
  expect(row).toHaveTextContent('70.50 gal')
  expect(row).toHaveTextContent(/litros · \d+ pulg\./)
  // Saved before specs/0021: only the loaded range
  expect(row).toHaveTextContent('~670 km cargado')
  expect(row).not.toHaveTextContent('vacío')
  expect(row).toHaveTextContent('odómetro 120,500 km')
  expect(row).toHaveTextContent('Managua, Nicaragua')

  const second = screen.getByRole('article', { name: 'Tanque de 50' })
  expect(second).toHaveTextContent('Tanque individual')
  fireEvent.click(
    within(second).getByRole('button', { name: 'Ver 1 medición' })
  )
  expect(within(second).getByRole('listitem')).toHaveTextContent(
    'Sin ubicación'
  )
})

// backend specs/0021 CA-5, RF-9
describe('loaded and empty', () => {
  test('a measurement shows both ranges, in the organization unit', async () => {
    useSessionStore.setState(state => ({
      organization: state.organization && {
        ...state.organization,
        distanceUnit: 'mi',
      },
    }))
    historyApi.readHistoryPage.mockResolvedValue({
      items: [
        cloudMeasurement({
          estimate: { km: 425, miles: 264.08, kmPerGal: 8.5 },
          estimateEmpty: { km: 550, miles: 341.75, kmPerGal: 11 },
        }),
      ],
      cursor: null,
    })
    renderHistory()

    const tank = await screen.findByRole('article', {
      name: 'Tanque izquierdo',
    })
    // A single tank opens with its measurements shown
    expect(within(tank).getByRole('listitem')).toHaveTextContent(
      '~264 mi cargado · ~342 mi vacío'
    )
  })

  test('editing recalculates both with the truck of today', async () => {
    fleetApi.readFleet.mockResolvedValue({
      trucks: [
        truck({ fuelEfficiencyKmPerGal: 8.5, fuelEfficiencyEmptyKmPerGal: 11 }),
      ],
      trailers: [trailer()],
      tanks: [tank()],
    })
    historyApi.readHistoryPage.mockResolvedValue({
      items: [cloudMeasurement()],
      cursor: null,
    })
    renderHistory()
    await openOptions('Editar')

    const dialog = screen.getByRole('dialog', { name: 'Corregir medición' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(historyApi.updateCloudMeasurement).toHaveBeenCalledWith(
        'm-1',
        'luis',
        expect.objectContaining({
          reading: expect.objectContaining({
            estimate: expect.objectContaining({ kmPerGal: 8.5 }) as unknown,
            estimateEmpty: expect.objectContaining({
              kmPerGal: 11,
            }) as unknown,
          }) as unknown,
        })
      )
    })
  })
})

test('the summary compares the first and last measurement of the period', async () => {
  renderHistory()
  const card = await screen.findByRole('article', { name: 'Tanque izquierdo' })
  expect(card).toHaveTextContent('Al inicio70.50galones')
  expect(card).toHaveTextContent('Al final60.00galones')
  expect(card).toHaveTextContent('Diferencia10.50gal. menos')
})

test('a pending place and an imported place read as such', async () => {
  historyApi.readHistoryPage.mockResolvedValue({
    items: [
      cloudMeasurement({ place: null, placeStatus: null }),
      cloudMeasurement({
        id: 'm-4',
        location: null,
        place: null,
        placeStatus: null,
        legacyPlace: 'León, Nicaragua',
        source: 'import',
      }),
    ],
    cursor: null,
  })
  renderHistory()
  const card = await screen.findByRole('article', { name: 'Tanque izquierdo' })
  // A single tank opens already expanded
  const rows = within(card).getAllByRole('listitem')
  expect(rows[0]).toHaveTextContent('Buscando el lugar…')
  expect(rows[1]).toHaveTextContent('León, Nicaragua')
})

test('the equipment filter queries that truck or trailer (CA-6)', async () => {
  renderHistory()
  await screen.findByRole('article', { name: 'Tanque izquierdo' })

  await choose('Equipo', 'Remolque · Caja 7')
  await waitFor(() => {
    expect(historyApi.readHistoryPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ equipmentId: 'trailer-1', after: null })
    )
  })
})

test('"Ver más" loads the next page after the cursor (RF-11)', async () => {
  const cursor = { id: 'cursor' }
  historyApi.readHistoryPage
    .mockResolvedValueOnce({ items: [cloudMeasurement()], cursor })
    .mockResolvedValueOnce({
      items: [cloudMeasurement({ id: 'm-9', gallons: 90 })],
      cursor: null,
    })
  renderHistory()

  fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }))
  await waitFor(() => {
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
  expect(historyApi.readHistoryPage).toHaveBeenLastCalledWith(
    expect.objectContaining({ after: cursor })
  )
  expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull()
})

test('who can edit and delete: the author for 24 hours, owner and supervisor always (RF-14)', () => {
  const now = Date.now()
  const recent = cloudMeasurement({ createdAt: new Date(now - 23 * HOUR) })
  const old = cloudMeasurement({ createdAt: new Date(now - 25 * HOUR) })

  expect(canChange(recent, 'driver', 'luis', now)).toBe(true)
  expect(canChange(old, 'driver', 'luis', now)).toBe(false)
  expect(canChange(recent, 'driver', 'ana', now)).toBe(false)
  expect(canChange(old, 'owner', 'ana', now)).toBe(true)
  expect(canChange(old, 'supervisor', 'ana', now)).toBe(true)
  expect(canChange(recent, 'viewer', 'luis', now)).toBe(false)
})

test('a driver no longer sees the options of their measurement after 24 hours (CA-7)', async () => {
  signIn('driver')
  historyApi.readHistoryPage.mockResolvedValue({
    items: [
      cloudMeasurement({ id: 'new', createdAt: new Date() }),
      cloudMeasurement({
        id: 'old',
        createdAt: new Date(Date.now() - 25 * HOUR),
      }),
    ],
    cursor: null,
  })
  renderHistory()
  const card = await screen.findByRole('article', { name: 'Tanque izquierdo' })

  const [recent, old] = within(card).getAllByRole('listitem')
  expect(
    within(recent as HTMLElement).getByRole('button', { name: /Opciones/ })
  ).toBeInTheDocument()
  expect(
    within(old as HTMLElement).queryByRole('button', { name: /Opciones/ })
  ).toBeNull()
})

const openOptions = async (choice: 'Editar' | 'Borrar') => {
  const card = await screen.findByRole('article', { name: 'Tanque izquierdo' })
  fireEvent.click(
    within(card).getAllByRole('button', { name: /Opciones/ })[0] as HTMLElement
  )
  fireEvent.click(screen.getByRole('menuitem', { name: choice }))
}

// Regression: a tank no longer on a truck has no odometer field, and saving
// any correction erased the odometer the measurement had
test('correcting a measurement of a tank off its truck keeps its odometer', async () => {
  historyApi.readHistoryPage.mockResolvedValue({
    items: [cloudMeasurement({ tankId: 'tank-2', odometerKm: 120500 })],
    cursor: null,
  })
  renderHistory()
  await openOptions('Editar')

  const dialog = screen.getByRole('dialog', { name: 'Corregir medición' })
  fireEvent.change(within(dialog).getByLabelText('Pulgadas de combustible'), {
    target: { value: '10' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

  await waitFor(() => {
    expect(historyApi.updateCloudMeasurement).toHaveBeenCalledWith(
      'm-1',
      'luis',
      expect.objectContaining({ tankId: 'tank-2', odometerKm: 120500 })
    )
  })
})

// Measuring no longer asks for the odometer: it is added here, in the
// organization's unit (specs/0010 CA-3)
test('editing adds the odometer in the organization unit', async () => {
  useSessionStore.setState(state => ({
    organization: state.organization && {
      ...state.organization,
      distanceUnit: 'mi',
    },
  }))
  historyApi.readHistoryPage.mockResolvedValue({
    items: [cloudMeasurement({ odometerKm: null })],
    cursor: null,
  })
  renderHistory()
  await openOptions('Editar')

  const dialog = screen.getByRole('dialog', { name: 'Corregir medición' })
  fireEvent.change(within(dialog).getByLabelText('Odómetro (opcional)'), {
    target: { value: '100000' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

  await waitFor(() => {
    expect(historyApi.updateCloudMeasurement).toHaveBeenCalledWith(
      'm-1',
      'luis',
      expect.objectContaining({ odometerKm: 160934 })
    )
  })
})

test('editing recomputes with the chosen tank and saves without waiting (RF-12, CA-7)', async () => {
  historyApi.readHistoryPage.mockResolvedValue({
    items: [cloudMeasurement()],
    cursor: null,
  })
  renderHistory()
  await openOptions('Editar')

  const dialog = screen.getByRole('dialog', { name: 'Corregir medición' })
  await choose('Tanque', 'Tanque de 50', dialog)
  fireEvent.change(within(dialog).getByLabelText('Pulgadas de combustible'), {
    target: { value: '12,5' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

  await waitFor(() => {
    expect(historyApi.updateCloudMeasurement).toHaveBeenCalledWith(
      'm-1',
      'luis',
      expect.objectContaining({
        tankId: 'tank-2',
        tankName: 'Tanque de 50',
        equipment: { kind: 'none', id: null, name: null },
        // An individual tank has no truck: no estimate and no odometer
        odometerKm: null,
        reading: expect.objectContaining({
          inches: 12.5,
          estimate: null,
        }) as unknown,
      })
    )
  })
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Medición corregida' })
  // Shown at once under its new tank
  expect(
    await screen.findByRole('article', { name: 'Tanque de 50' })
  ).toBeInTheDocument()
})

test('the edit form rejects more inches than the tank allows', async () => {
  historyApi.readHistoryPage.mockResolvedValue({
    items: [cloudMeasurement()],
    cursor: null,
  })
  renderHistory()
  await openOptions('Editar')

  const dialog = screen.getByRole('dialog', { name: 'Corregir medición' })
  fireEvent.change(within(dialog).getByLabelText('Pulgadas de combustible'), {
    target: { value: '40' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

  expect(
    await within(dialog).findByText('Este tanque permite hasta 24 pulgadas.')
  ).toBeInTheDocument()
  expect(historyApi.updateCloudMeasurement).not.toHaveBeenCalled()
})

test('a rejected edit is reported to the user', async () => {
  historyApi.readHistoryPage.mockResolvedValue({
    items: [cloudMeasurement()],
    cursor: null,
  })
  historyApi.updateCloudMeasurement.mockRejectedValueOnce(
    new Error('permission-denied')
  )
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  renderHistory()
  await openOptions('Editar')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  await waitFor(() => {
    expect(sileo.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No pudimos guardar el cambio' })
    )
  })
})

test('deleting asks first, then removes the measurement (RF-13)', async () => {
  historyApi.readHistoryPage.mockResolvedValue({
    items: [cloudMeasurement()],
    cursor: null,
  })
  renderHistory()
  await openOptions('Borrar')

  const confirm = screen.getByRole('dialog', { name: '¿Borrar esta medición?' })
  fireEvent.click(within(confirm).getByRole('button', { name: 'Borrar' }))

  expect(historyApi.deleteCloudMeasurement).toHaveBeenCalledWith('m-1')
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Medición borrada' })
  expect(
    await screen.findByText('Sin mediciones en este periodo')
  ).toBeInTheDocument()
})

test('a viewer sees the history without options', async () => {
  signIn('viewer')
  renderHistory()
  const card = await screen.findByRole('article', { name: 'Tanque izquierdo' })
  expect(within(card).getAllByRole('listitem')).toHaveLength(2)
  expect(within(card).queryByRole('button', { name: /Opciones/ })).toBeNull()
})

test('a failed load offers to retry', async () => {
  historyApi.readHistoryPage.mockRejectedValueOnce(new Error('unavailable'))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  renderHistory()

  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
  expect(
    await screen.findByRole('article', { name: 'Tanque izquierdo' })
  ).toBeInTheDocument()
})
