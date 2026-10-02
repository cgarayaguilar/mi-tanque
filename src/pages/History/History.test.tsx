import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../App'
import { db, type StoredMeasurement } from 'services/db'
import { useHistoryStore } from 'store/history'
import { settle } from '../../testUtils'

const renderHistory = () => {
  window.history.pushState({}, '', '/history')
  render(<App />)
}

const DAY = 24 * 60 * 60 * 1000

const measurement = ({
  tankId,
  gallons,
  daysAgo = 1,
}: {
  tankId: number
  gallons: number
  daysAgo?: number
}): StoredMeasurement => ({
  date: new Date(Date.now() - daysAgo * DAY),
  inches: 10,
  gallons: gallons.toFixed(2),
  liters: (gallons * 3.785).toFixed(2),
  fuelHeight: '41.67',
  location: 'Sin ubicación',
  tankId,
})

const addTank = () => db.tanks.add({ capacity: 75, diameter: 24, length: 41 })

beforeEach(async () => {
  window.localStorage.clear()
  useHistoryStore.setState({
    chosenPeriod: null,
    status: 'idle',
    histories: [],
  })
  await db.measurements.clear()
  await db.tanks.clear()
  vi.spyOn(console, 'error')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

test('explains an empty period and offers to change it', async () => {
  renderHistory()

  expect(
    await screen.findByRole('heading', {
      name: 'Sin mediciones en este periodo',
    })
  ).toBeInTheDocument()
  expect(console.error).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Cambiar periodo' }))
  // (jsdom has no layout, so the calendar itself may log; not checked here)
  expect(
    await screen.findByRole('dialog', { name: 'Selecciona un periodo' })
  ).toBeInTheDocument()
})

test('summarizes each tank and lists its measurements, newest first', async () => {
  const tankId = await addTank()
  await db.measurements.bulkAdd([
    measurement({ tankId, gallons: 40, daysAgo: 3 }),
    measurement({ tankId, gallons: 30, daysAgo: 1 }),
  ])

  renderHistory()

  expect(
    await screen.findByRole('heading', { name: 'Tanque de 75 gls' })
  ).toBeInTheDocument()
  expect(screen.getByText('2 mediciones')).toBeInTheDocument()
  // Difference from the first (40) to the last (30) measurement
  expect(screen.getByText('10.00')).toBeInTheDocument()
  expect(screen.getByText('gal. menos')).toBeInTheDocument()

  // A single tank shows its measurements right away
  const list = screen.getByRole('list', {
    name: 'Mediciones del tanque de 75 galones',
  })
  const [newest, oldest] = Array.from(list.querySelectorAll('li'))
  expect(newest).toHaveTextContent('30.00 gal de 75')
  // Liters in full: "L" is also the lempira (specs/0012 RF-7)
  expect(newest).toHaveTextContent(/litros · \d+ pulg\./)
  expect(oldest).toHaveTextContent('40.00 gal de 75')
  expect(
    screen.getAllByRole('progressbar', { name: 'Nivel del tanque: 42%' })
  ).toHaveLength(2)
  expect(console.error).not.toHaveBeenCalled()
})

test('each tank history is a disclosure button', async () => {
  const tankId = await addTank()
  const otherId = await db.tanks.add({ capacity: 50, diameter: 25, length: 26 })
  await db.measurements.bulkAdd([
    measurement({ tankId, gallons: 40 }),
    measurement({ tankId: otherId, gallons: 20 }),
  ])

  renderHistory()

  // With several tanks they start collapsed
  const [toggle] = await screen.findAllByRole('button', {
    name: 'Ver 1 medición',
  })
  if (!toggle) throw new Error('No disclosure button')
  expect(toggle).toHaveAttribute('aria-expanded', 'false')

  fireEvent.click(toggle)

  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(toggle).toHaveAccessibleName('Ocultar mediciones')
  expect(
    document.getElementById(toggle.getAttribute('aria-controls') ?? '')
  ).not.toBeNull()
})

test('keeps showing valid tanks when a measurement points to a missing tank', async () => {
  const tankId = await addTank()
  await db.measurements.bulkAdd([
    measurement({ tankId, gallons: 40 }),
    measurement({ tankId: 9999, gallons: 20 }),
  ])

  renderHistory()

  expect(
    await screen.findByRole('heading', { name: 'Tanque de 75 gls' })
  ).toBeInTheDocument()
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(console.error).not.toHaveBeenCalled()
})

test('shows the empty period when every measurement points to a missing tank', async () => {
  await db.measurements.add(measurement({ tankId: 9999, gallons: 20 }))

  renderHistory()

  expect(
    await screen.findByRole('heading', {
      name: 'Sin mediciones en este periodo',
    })
  ).toBeInTheDocument()
})

test('a failed load explains it and can be retried', async () => {
  vi.mocked(console.error).mockImplementation(() => {})
  vi.spyOn(db.measurements, 'where').mockImplementationOnce(() => {
    throw new Error('Blocked')
  })
  const tankId = await addTank()
  await db.measurements.add(measurement({ tankId, gallons: 40 }))

  renderHistory()
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))

  expect(
    await screen.findByRole('heading', { name: 'Tanque de 75 gls' })
  ).toBeInTheDocument()
})

test('the period picker is an accessible dialog that can be cancelled', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 30, 9, 0))
  renderHistory()

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Periodo: 23 sep – 30 sep 2026. Cambiar',
    })
  )
  expect(
    await screen.findByRole('dialog', { name: 'Selecciona un periodo' })
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// Regression: the period ended at 23:00 of its last day (addHours truncated
// 23.59 to 23), so late measurements were missing from the history
test('includes measurements taken in the last hour of the period', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 30, 9, 0))
  const tankId = await addTank()
  await db.measurements.add({
    ...measurement({ tankId, gallons: 40 }),
    date: new Date(2026, 8, 30, 23, 30),
  })

  renderHistory()

  expect(
    await screen.findByRole('heading', { name: 'Tanque de 75 gls' })
  ).toBeInTheDocument()
  await settle()
})

test('the navigation marks the current section and switches to Medición', async () => {
  renderHistory()

  const nav = await screen.findByRole('navigation', { name: 'Secciones' })
  expect(
    screen.getByRole('link', { name: 'Historial', current: 'page' })
  ).toBeInTheDocument()
  expect(nav).toContainElement(screen.getByRole('link', { name: 'Medición' }))

  fireEvent.click(screen.getByRole('link', { name: 'Medición' }))

  await waitFor(() => {
    expect(window.location.pathname).toBe('/')
  })
})
