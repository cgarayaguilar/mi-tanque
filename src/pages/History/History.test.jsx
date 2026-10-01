import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  vi.useRealTimers()
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

test('opens the period picker as an accessible dialog and closes it', async () => {
  renderHistory()

  fireEvent.click(await screen.findByLabelText('Seleccione un periodo'))

  const dialog = await screen.findByRole('dialog', {
    name: 'Selecciona un periodo',
  })
  expect(dialog).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

// Regression: the period ended at 23:00 of its last day (addHours truncated
// 23.59 to 23), so late measurements were missing from the history
test('includes measurements taken in the last hour of the period', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 30, 9, 0))
  const tankId = await db.tanks.add({ capacity: 75, diameter: 24, length: 41 })
  await db.measurements.add({
    ...measurement({ tankId, gallons: 40 }),
    date: new Date(2026, 8, 30, 23, 30),
  })

  renderHistory()

  expect(await screen.findByText('Tanque 75 gls')).toBeInTheDocument()
})

test('each tank history is a disclosure button', async () => {
  const tankId = await db.tanks.add({ capacity: 75, diameter: 24, length: 41 })
  await db.measurements.add(measurement({ tankId, gallons: 40 }))

  renderHistory()

  const toggle = await screen.findByRole('button', { name: /Tanque 75 gls/ })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')

  fireEvent.click(toggle)

  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(
    document.getElementById(toggle.getAttribute('aria-controls'))
  ).not.toBeNull()
})
