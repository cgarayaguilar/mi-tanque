import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import AppProvider from 'store'
import { db } from 'services/db'
import { settle } from '../../testUtils'

const fillAndSubmit = async ({ capacity, diameter, length }) => {
  window.history.pushState({}, '', '/tanques/crear')

  render(
    <AppProvider>
      <App />
    </AppProvider>
  )

  fireEvent.change(
    await screen.findByLabelText('Capacidad en galones de su tanque'),
    { target: { value: capacity } }
  )
  fireEvent.change(screen.getByLabelText('Diámetro en pulgadas de su tanque'), {
    target: { value: diameter },
  })
  fireEvent.change(screen.getByLabelText('Longitud en pulgadas de su tanque'), {
    target: { value: length },
  })
  fireEvent.click(screen.getByText('Guardar'))
}

const storedDefaultTank = () =>
  JSON.parse(window.localStorage.getItem('defaultTank') ?? 'null')

beforeEach(async () => {
  window.localStorage.clear()
  await db.tanks.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('saves the tank, selects it with numeric dimensions and confirms', async () => {
  await fillAndSubmit({ capacity: '80', diameter: '22', length: '50' })

  await waitFor(() =>
    expect(sileo.success).toHaveBeenCalledWith({ title: 'Tanque agregado' })
  )
  const [saved] = await db.tanks.toArray()
  expect(saved).toMatchObject({ capacity: 80, diameter: 22, length: 50 })
  expect(storedDefaultTank()).toEqual({
    id: saved.id,
    capacity: 80,
    diameter: 22,
    length: 50,
  })
  expect(window.location.pathname).toBe('/')
})

// Regression: a failed save used to show "Tanque agregado correctamente" and
// select a tank without id.
test('reports a failed save and keeps the user on the form', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(db.tanks, 'add').mockRejectedValueOnce(new Error('QuotaExceeded'))

  await fillAndSubmit({ capacity: '80', diameter: '22', length: '50' })

  await waitFor(() =>
    expect(sileo.error).toHaveBeenCalledWith({
      title: 'No pudimos guardar el tanque',
      description: 'Reintenta en un momento.',
    })
  )
  await settle()

  expect(sileo.success).not.toHaveBeenCalled()
  expect(storedDefaultTank()).toBeNull()
  expect(window.location.pathname).toBe('/tanques/crear')
  expect(consoleError).toHaveBeenCalledWith(
    '[createTank]',
    expect.objectContaining({ operation: 'createTank' }),
    expect.any(Error)
  )
})

// Regression: "Guardar" stayed enabled while saving, so a double tap could
// create the same tank twice
test('a double tap on Guardar creates the tank once', async () => {
  await fillAndSubmit({ capacity: '80', diameter: '22', length: '50' })
  const busyButton = screen.getByRole('button', { name: 'Guardando…' })
  expect(busyButton).toBeDisabled()
  fireEvent.click(busyButton)

  await waitFor(() => expect(sileo.success).toHaveBeenCalledTimes(1))
  await settle()

  expect(await db.tanks.count()).toBe(1)
})

test('explains invalid dimensions with a Sileo warning and saves nothing', async () => {
  await fillAndSubmit({ capacity: '300', diameter: '22', length: '50' })

  await waitFor(() =>
    expect(sileo.warning).toHaveBeenCalledWith({
      title: 'Revisa las medidas del tanque',
      description: 'Ingresa una capacidad entre 10 y 250',
    })
  )
  expect(await db.tanks.count()).toBe(0)
})

test('warns when a tank with the same dimensions exists', async () => {
  await db.tanks.add({ capacity: 80, diameter: 22, length: 50 })

  await fillAndSubmit({ capacity: '80', diameter: '22', length: '50' })

  await waitFor(() =>
    expect(sileo.warning).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ese tanque ya existe' })
    )
  )
  expect(await db.tanks.count()).toBe(1)
})
