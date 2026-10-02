import { StrictMode } from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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

afterEach(async () => {
  // A load still in flight would otherwise finish in the next test
  await settle()
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
      name: 'Seleccionar: tanque de 75 galones, 24 pulgadas de diámetro y 41 de largo',
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
    await screen.findByRole('heading', {
      name: 'Ningún tanque con esos filtros',
    })
  ).toBeInTheDocument()

  fireEvent.click(
    screen.getAllByRole('button', { name: 'Limpiar' })[0] as HTMLElement
  )
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
      name: 'Seleccionar: tanque de 80 galones, 24.5 pulgadas de diámetro y 50 de largo, tuyo',
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

test('marks the tank being measured', async () => {
  await useTanksStore.getState().load()
  const measured = useTanksStore
    .getState()
    .tanks.find(tank => tank.capacity === 75 && tank.length === 41)
  if (!measured) throw new Error('Predefined tank missing')
  useSelectedTankStore.getState().selectTank(measured)

  renderTankSearch()

  expect(
    await screen.findByRole('button', {
      name: 'Seleccionar: tanque de 75 galones, 24 pulgadas de diámetro y 41 de largo',
    })
  ).toHaveAttribute('aria-current', 'true')
  expect(
    screen.getByRole('button', {
      name: 'Seleccionar: tanque de 50 galones, 25 pulgadas de diámetro y 26 de largo',
    })
  ).not.toHaveAttribute('aria-current')
})

// specs/0014 CA-1, CA-2, CA-7: grouped by capacity, filtered, yours marked
test('tanks are grouped by capacity, filtered with chips, and yours say so', async () => {
  // The predefined tanks first, then one the user added
  await useTanksStore.getState().load()
  await db.tanks.add({ capacity: 100, diameter: 30, length: 33 })
  useTanksStore.setState({ tanks: [], status: 'idle' })
  renderTankSearch()

  const hundred = await screen.findByRole('region', { name: '100 galones' })
  expect(hundred).toHaveTextContent('100 gal · 4 tanques')
  expect(
    screen.getAllByRole('button', { name: /de largo, tuyo$/ })
  ).toHaveLength(1)
})

test('capacity and diameter chips combine, and Limpiar clears them', async () => {
  renderTankSearch()
  await screen.findByText('15 tanques')

  const capacity = screen.getAllByRole('group', {
    name: 'Capacidad',
  })[0] as HTMLElement
  fireEvent.click(within(capacity).getByRole('button', { name: '100 gal' }))
  expect(await screen.findByText('3 tanques')).toBeInTheDocument()

  const diameter = screen.getAllByRole('group', {
    name: 'Diámetro',
  })[0] as HTMLElement
  fireEvent.click(within(diameter).getByRole('button', { name: '24 pulg.' }))
  expect(await screen.findByText('1 tanque')).toBeInTheDocument()
  expect(
    within(diameter).getByRole('button', { name: '24 pulg.' })
  ).toHaveAttribute('aria-pressed', 'true')

  fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
  expect(await screen.findByText('15 tanques')).toBeInTheDocument()
})
