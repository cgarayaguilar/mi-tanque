import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../App'
import { db } from 'services/db'
import { useSelectedTankStore } from 'store/selectedTank'
import { useTanksStore } from 'store/tanks'
import { settle } from '../../testUtils'

const renderTankSearch = ({ strict = false } = {}) => {
  window.history.pushState({}, '', '/tanques')
  const app = <App />
  render(strict ? <StrictMode>{app}</StrictMode> : app)
}

const search = (value: string) => {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar tanque' }), {
    target: { value },
  })
}

beforeEach(async () => {
  window.localStorage.clear()
  useSelectedTankStore.getState().rehydrate()
  useTanksStore.setState({ tanks: [], status: 'idle' })
  await db.tanks.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// StrictMode runs effects twice in development (React 18+): the first visit
// must still seed the predefined tanks exactly once.
test('seeds the predefined tanks once on the first visit', async () => {
  renderTankSearch({ strict: true })

  expect(await screen.findByText('15 tanques')).toBeInTheDocument()
  await settle()

  expect(await db.tanks.count()).toBe(15)
})

test('shows placeholders while the tanks load', async () => {
  renderTankSearch()

  expect(screen.getByLabelText('Cargando tanques')).toHaveAttribute(
    'aria-busy',
    'true'
  )
  expect(await screen.findByText('15 tanques')).toBeInTheDocument()
})

test('selecting a tank remembers it and goes to the measurement', async () => {
  renderTankSearch()

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Seleccionar: tanque de 75 galones, 24 por 41 pulgadas',
    })
  )

  expect(useSelectedTankStore.getState().selectedTank).toMatchObject({
    capacity: 75,
    diameter: 24,
    length: 41,
  })
  expect(window.location.pathname).toBe('/')
})

test('filters by any dimension and offers to clear an empty search', async () => {
  renderTankSearch()
  await screen.findByText('15 tanques')

  search('150')
  expect(await screen.findByText('2 tanques')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)

  search('999')
  expect(
    await screen.findByRole('heading', { name: 'No encontramos ese tanque' })
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))
  expect(await screen.findByText('15 tanques')).toBeInTheDocument()
})

test('a decimal search matches with a comma or a dot', async () => {
  await db.tanks.add({ capacity: 80, diameter: 24.5, length: 50 })
  renderTankSearch()
  await screen.findByText('1 tanque')

  search('24,5')

  expect(await screen.findByText('1 tanque')).toBeInTheDocument()
  // Shown the way it was typed
  expect(
    screen.getByRole('button', {
      name: 'Seleccionar: tanque de 80 galones, 24,5 por 50 pulgadas',
    })
  ).toBeInTheDocument()
})

test('a failed load explains it and can be retried', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(db.tanks, 'toArray').mockRejectedValueOnce(new Error('Blocked'))
  renderTankSearch()

  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))

  expect(await screen.findByText('15 tanques')).toBeInTheDocument()
})

test('"Agregar tanque" opens the form', async () => {
  renderTankSearch()

  fireEvent.click(screen.getByRole('button', { name: 'Agregar tanque' }))

  await waitFor(() => {
    expect(window.location.pathname).toBe('/tanques/crear')
  })
})
