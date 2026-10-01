import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import AppProvider from 'store'
import { db } from 'services/db'
import { settle } from '../../testUtils'

const renderAt = path => {
  window.history.pushState({}, '', path)

  return render(
    <AppProvider>
      <App />
    </AppProvider>
  )
}

// Geolocation answers asynchronously, like a real browser (denied by default)
const mockGeolocation = ({ coords } = {}) => {
  const geolocation = {
    getCurrentPosition: vi.fn((success, error) =>
      setTimeout(() => {
        if (coords) success({ coords })
        else error({ code: 1, message: 'User denied Geolocation' })
      }, 50)
    ),
    watchPosition: vi.fn(() => 1),
    clearWatch: vi.fn(),
  }

  Object.defineProperty(navigator, 'geolocation', {
    value: geolocation,
    configurable: true,
  })

  return geolocation
}

let consoleError

beforeEach(async () => {
  window.localStorage.clear()
  await db.measurements.clear()
  await db.tanks.clear()
  consoleError = vi.spyOn(console, 'error')
  mockGeolocation()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete navigator.geolocation
})

test('redirects to the tank list without updating Home after it unmounts', async () => {
  renderAt('/')

  expect(await screen.findByText('Seleccione su tanque')).toBeInTheDocument()

  // Let pending IndexedDB queries and geolocation callbacks settle
  await settle()

  expect(consoleError).not.toHaveBeenCalled()
})

test('saves the measurement with the city name of the current position', async () => {
  const tankId = await db.tanks.add({ capacity: 50, diameter: 25, length: 26 })
  window.localStorage.setItem(
    'defaultTank',
    JSON.stringify({ id: tankId, capacity: 50, diameter: 25, length: 26 })
  )
  mockGeolocation({ coords: { latitude: 12.13, longitude: -86.25 } })
  const fetch = vi.fn().mockResolvedValue({
    json: async () => ({
      features: [{ properties: { locality: 'Managua', country: 'Nicaragua' } }],
    }),
  })
  vi.stubGlobal('fetch', fetch)

  renderAt('/')

  fireEvent.change(
    await screen.findByPlaceholderText('Ingrese la cantidad de pulgadas'),
    { target: { value: '12' } }
  )
  fireEvent.click(screen.getByText('Calcular'))

  await waitFor(async () => {
    expect(await db.measurements.count()).toBe(1)
  })

  const [saved] = await db.measurements.toArray()
  expect(saved).toMatchObject({
    tankId,
    inches: 12,
    location: 'Managua, Nicaragua',
  })
  expect(fetch.mock.calls[0][0]).toContain('point.lat=12.13&point.lon=-86.25')
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Medición guardada' })
})

const selectTankAndCalculate = async inches => {
  const tankId = await db.tanks.add({ capacity: 50, diameter: 25, length: 26 })
  window.localStorage.setItem(
    'defaultTank',
    JSON.stringify({ id: tankId, capacity: 50, diameter: 25, length: 26 })
  )
  renderAt('/')

  fireEvent.change(
    await screen.findByPlaceholderText('Ingrese la cantidad de pulgadas'),
    { target: { value: inches } }
  )
  fireEvent.click(screen.getByText('Calcular'))
}

// Regression: a failed save used to be silent (only console.error)
test('tells the user when the measurement could not be saved', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(db.measurements, 'add').mockRejectedValueOnce(new Error('Aborted'))

  await selectTankAndCalculate('12')

  await waitFor(() =>
    expect(sileo.error).toHaveBeenCalledWith({
      title: 'No pudimos guardar la medición',
      description: 'Reintenta en un momento.',
    })
  )
  expect(sileo.success).not.toHaveBeenCalled()
  expect(await db.measurements.count()).toBe(0)
})

// Regression: "Calcular" stayed enabled while saving, so a double tap stored
// the same measurement twice
test('a double tap on Calcular saves the measurement once', async () => {
  await selectTankAndCalculate('12')
  const busyButton = screen.getByRole('button', { name: 'Guardando…' })
  expect(busyButton).toBeDisabled()
  fireEvent.click(busyButton)

  await waitFor(() => expect(sileo.success).toHaveBeenCalledTimes(1))
  await settle()

  expect(await db.measurements.count()).toBe(1)
  expect(screen.getByRole('button', { name: 'Calcular' })).toBeEnabled()
})
