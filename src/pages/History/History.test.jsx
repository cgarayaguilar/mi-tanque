import { render, screen } from '@testing-library/react'
import App from '../../App'
import AppProvider from 'store'
import { db } from 'services/db'
import { settle } from '../../testUtils'

const renderHistory = () => {
  window.history.pushState({}, '', '/history')

  return render(
    <AppProvider>
      <App />
    </AppProvider>
  )
}

const measurement = ({ tankId, gallons, daysAgo = 1 }) => ({
  date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  inches: 10,
  gallons,
  liters: gallons * 3.785,
  location: 'Sin ubicación',
  tankId,
})

let consoleError

beforeEach(async () => {
  await db.measurements.clear()
  await db.tanks.clear()
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  consoleError.mockRestore()
})

test('shows the empty message without errors when there are no measurements', async () => {
  renderHistory()

  // The empty message is also the initial state, so let the IndexedDB query settle first
  await settle()

  expect(screen.getByText(/No se encontraron mediciones/)).toBeInTheDocument()
  expect(consoleError).not.toHaveBeenCalled()
})

test('lists the measurements of each tank and the gallon totals', async () => {
  const tankId = await db.tanks.add({ capacity: 75, diameter: 24, length: 41 })
  await db.measurements.bulkAdd([
    measurement({ tankId, gallons: 40, daysAgo: 3 }),
    measurement({ tankId, gallons: 30, daysAgo: 1 }),
  ])

  renderHistory()

  expect(await screen.findByText('Tanque 75 gls')).toBeInTheDocument()
  expect(screen.getByText('Total: 2 mediciones')).toBeInTheDocument()
  expect(consoleError).not.toHaveBeenCalled()
})

test('keeps showing valid tanks when a measurement points to a missing tank', async () => {
  const tankId = await db.tanks.add({ capacity: 75, diameter: 24, length: 41 })
  await db.measurements.bulkAdd([
    measurement({ tankId, gallons: 40 }),
    measurement({ tankId: 9999, gallons: 20 }),
  ])

  renderHistory()

  expect(await screen.findByText('Tanque 75 gls')).toBeInTheDocument()
  expect(consoleError).not.toHaveBeenCalled()
})

test('shows the empty message when every measurement points to a missing tank', async () => {
  await db.measurements.add(measurement({ tankId: 9999, gallons: 20 }))

  renderHistory()

  await settle()

  expect(screen.getByText(/No se encontraron mediciones/)).toBeInTheDocument()
  expect(consoleError).not.toHaveBeenCalled()
})
