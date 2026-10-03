import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { sileo } from 'sileo'
import type { MockInstance } from 'vitest'
import App from '../../App'
import { db } from 'services/db'
import { useSelectedTankStore } from 'store/selectedTank'
import { settle } from '../../testUtils'

// The place comes from the backend's `geocode` function (specs/0008)
const places = vi.hoisted(() => ({
  lookupPlace: vi.fn(() => Promise.resolve<string | null>(null)),
}))
vi.mock('services/placeLookup', () => places)

const tank = { capacity: 50, diameter: 25, length: 26 }

const renderHome = () => {
  window.history.pushState({}, '', '/')
  render(<App />)
}

const selectTank = async () => {
  const id = await db.tanks.add(tank)
  window.localStorage.setItem('defaultTank', JSON.stringify({ id, ...tank }))
  useSelectedTankStore.getState().rehydrate()
  return id
}

// Geolocation answers asynchronously, like a real browser (denied by default)
const mockGeolocation = (coords?: { latitude: number; longitude: number }) => {
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
        }, 50),
    },
  })
}

const inchesField = () => screen.getByLabelText('Pulgadas de combustible')

const calculate = (inches: string) => {
  fireEvent.change(inchesField(), { target: { value: inches } })
  fireEvent.click(screen.getByRole('button', { name: 'Calcular' }))
}

let consoleError: MockInstance<typeof console.error>

beforeEach(async () => {
  window.localStorage.clear()
  useSelectedTankStore.getState().rehydrate()
  await db.measurements.clear()
  await db.tanks.clear()
  consoleError = vi.spyOn(console, 'error')
  mockGeolocation()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'geolocation')
})

test('without a tank it explains why and offers to choose one', async () => {
  renderHome()

  expect(
    screen.getByRole('heading', { name: 'Elige tu tanque para empezar' })
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Elegir tanque' }))

  expect(window.location.pathname).toBe('/tanques')
  await settle()
  expect(consoleError).not.toHaveBeenCalled()
})

test('before calculating, results show that nothing was measured', async () => {
  await selectTank()
  renderHome()

  expect(
    await screen.findByRole('img', { name: 'Tanque sin medir' })
  ).toBeInTheDocument()
  expect(screen.getAllByText('—')).toHaveLength(3)
})

test('saves the measurement with the city name and shows the reading', async () => {
  const tankId = await selectTank()
  mockGeolocation({ latitude: 12.13, longitude: -86.25 })
  places.lookupPlace.mockResolvedValueOnce('Managua, Nicaragua')
  renderHome()

  calculate('12')

  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalledWith({ title: 'Medición guardada' })
  })
  // The place name is added once the GPS and the geocoding answer
  await waitFor(async () => {
    expect(await db.measurements.toArray()).toEqual([
      expect.objectContaining({
        tankId,
        inches: 12,
        location: 'Managua, Nicaragua',
      }),
    ])
  })
  // Google's text replaces the hidden reCAPTCHA badge (specs/0008 RF-12)
  expect(screen.getByText(/Protegido por reCAPTCHA/)).toBeInTheDocument()
  expect(places.lookupPlace).toHaveBeenCalledWith(
    expect.objectContaining({ latitude: 12.13, longitude: -86.25 })
  )
  // 50 gal that the 55.25 of its measures agree with: full holds 50, and the
  // percent is by volume (specs/0018 RF-1, RF-3)
  expect(
    screen.getByRole('img', { name: 'Tanque al 47%: 23.73 galones' })
  ).toBeInTheDocument()
})

// Regression: the save waited for the GPS (up to 10 s, or the permission
// prompt) and the geocoding before storing anything, so "Guardando…" hung
test('saves right away without waiting for the location', async () => {
  const tankId = await selectTank()
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    // Never answers, like a permission prompt nobody has replied to yet
    value: { getCurrentPosition: () => undefined },
  })
  renderHome()

  calculate('12')

  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalledWith({ title: 'Medición guardada' })
  })
  expect(await db.measurements.toArray()).toEqual([
    expect.objectContaining({ tankId, location: 'Sin ubicación' }),
  ])
  expect(screen.getByRole('button', { name: 'Calcular' })).toBeEnabled()
})

test('accepts decimal inches with a comma', async () => {
  await selectTank()
  renderHome()

  calculate('12,5')

  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalled()
  })
  const [saved] = await db.measurements.toArray()
  // Stored with a dot, shown with a comma
  expect(saved).toMatchObject({ inches: 12.5, fuelHeight: '50.00' })
  expect(screen.getByText('12.5')).toBeInTheDocument()
})

// §8.7: validation errors are shown inline under the field, not as toasts
test.each([
  ['', 'Ingresa las pulgadas que mediste'],
  ['doce', 'Escribe solo números, por ejemplo 12.5'],
  ['30', 'Tu tanque mide 25 pulgadas de diámetro. Ingresa hasta 25.'],
])('explains an invalid value %j under the field', async (inches, message) => {
  await selectTank()
  renderHome()

  calculate(inches)

  expect(await screen.findByText(message)).toBeInTheDocument()
  expect(inchesField()).toHaveAttribute('aria-invalid', 'true')
  expect(inchesField()).toHaveValue(inches)
  expect(sileo.warning).not.toHaveBeenCalled()
  await settle()
  expect(await db.measurements.count()).toBe(0)
})

// Regression: a failed save used to be silent (only console.error)
test('tells the user when the measurement could not be saved', async () => {
  consoleError.mockImplementation(() => undefined)
  await selectTank()
  vi.spyOn(db.measurements, 'add').mockRejectedValueOnce(new Error('Aborted'))
  renderHome()

  calculate('12')

  await waitFor(() => {
    expect(sileo.error).toHaveBeenCalledWith({
      title: 'No pudimos guardar la medición',
      description: 'Reintenta en un momento.',
    })
  })
  expect(sileo.success).not.toHaveBeenCalledWith({
    title: 'Medición guardada',
  })
  expect(await db.measurements.count()).toBe(0)
})

// Regression: a double tap on "Calcular" stored the measurement twice
test('a double tap on Calcular saves the measurement once', async () => {
  await selectTank()
  renderHome()

  calculate('12')
  const busy = await screen.findByRole('button', { name: /Guardando/ })
  expect(busy).toBeDisabled()
  fireEvent.click(busy)

  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalledTimes(1)
  })
  await settle()
  expect(await db.measurements.count()).toBe(1)
  expect(screen.getByRole('button', { name: 'Calcular' })).toBeEnabled()
})

// backend specs/0018 RF-4, CA-4: measures and capacity that disagree
test('a tank whose capacity does not fit its measures says so, by the measures', async () => {
  const wrong = { capacity: 70, diameter: 26, length: 48 }
  const id = await db.tanks.add(wrong)
  window.localStorage.setItem('defaultTank', JSON.stringify({ id, ...wrong }))
  useSelectedTankStore.getState().rehydrate()
  renderHome()

  calculate('26')

  // π · 13² · 48 / 231 = 110.32 gal by its measures, not its 70
  expect(
    await screen.findByRole('img', { name: 'Tanque al 100%: 110.32 galones' })
  ).toBeInTheDocument()
  const note = screen.getByRole('note')
  expect(note).toHaveTextContent(
    'Las medidas y la capacidad de este tanque no cuadran: revísalas.'
  )
  expect(
    within(note).getByRole('button', { name: 'Cambiar tanque' })
  ).toBeInTheDocument()
})

test('a tank whose capacity fits shows no warning', async () => {
  await selectTank()
  renderHome()
  calculate('25')
  expect(
    await screen.findByRole('img', { name: 'Tanque al 100%: 50.00 galones' })
  ).toBeInTheDocument()
  expect(screen.queryByRole('note')).toBeNull()
})
