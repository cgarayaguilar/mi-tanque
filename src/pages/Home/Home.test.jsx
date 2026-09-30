import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../../App'
import AppProvider from 'store'
import { db } from 'services/db'

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
  consoleError = vi.spyOn(console, 'error')
  mockGeolocation()
})

afterEach(() => {
  consoleError.mockRestore()
  vi.unstubAllGlobals()
  delete navigator.geolocation
})

test('redirects to the tank list without updating Home after it unmounts', async () => {
  renderAt('/')

  expect(await screen.findByText('Seleccione su tanque')).toBeInTheDocument()

  // Let pending IndexedDB queries and geolocation callbacks settle
  await new Promise(resolve => setTimeout(resolve, 200))

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
  expect(saved).toMatchObject({ tankId, inches: 12, location: 'Managua, Nicaragua' })
  expect(fetch.mock.calls[0][0]).toContain('point.lat=12.13&point.lon=-86.25')
})
