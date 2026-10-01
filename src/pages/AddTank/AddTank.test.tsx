import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { sileo, type SileoOptions } from 'sileo'
import App from '../../App'
import { db } from 'services/db'
import { useSelectedTankStore } from 'store/selectedTank'
import { useTanksStore } from 'store/tanks'
import { settle } from '../../testUtils'

interface Dimensions {
  capacity: string
  diameter: string
  length: string
}

const fill = async ({ capacity, diameter, length }: Dimensions) => {
  window.history.pushState({}, '', '/tanques/crear')
  render(<App />)

  fireEvent.change(await screen.findByLabelText('Capacidad'), {
    target: { value: capacity },
  })
  fireEvent.change(screen.getByLabelText('Diámetro'), {
    target: { value: diameter },
  })
  fireEvent.change(screen.getByLabelText('Longitud'), {
    target: { value: length },
  })
}

const fillAndSubmit = async (dimensions: Dimensions) => {
  await fill(dimensions)
  fireEvent.click(screen.getByRole('button', { name: 'Guardar tanque' }))
}

const selectedTank = () => useSelectedTankStore.getState().selectedTank

beforeEach(async () => {
  window.localStorage.clear()
  useSelectedTankStore.getState().rehydrate()
  useTanksStore.setState({ tanks: [], status: 'idle' })
  await db.tanks.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('saves the tank, selects it with numeric dimensions and confirms', async () => {
  await fillAndSubmit({ capacity: '80', diameter: '22', length: '50' })

  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalledWith({ title: 'Tanque agregado' })
  })
  const [saved] = await db.tanks.toArray()
  expect(saved).toMatchObject({ capacity: 80, diameter: 22, length: 50 })
  expect(selectedTank()).toEqual({
    id: saved?.id,
    capacity: 80,
    diameter: 22,
    length: 50,
  })
  expect(window.location.pathname).toBe('/')
})

test('the preview draws the dimensions as they are typed', async () => {
  await fill({ capacity: '80', diameter: '24,5', length: '' })

  expect(
    screen.getByRole('img', {
      name: 'Tanque de 80 galones, 24,5 pulgadas de diámetro y — de largo',
    })
  ).toBeInTheDocument()
})

// Regression: a failed save used to show "Tanque agregado correctamente" and
// select a tank without id.
test('reports a failed save and keeps the user on the form', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(db.tanks, 'add').mockRejectedValueOnce(new Error('QuotaExceeded'))

  await fillAndSubmit({ capacity: '80', diameter: '22', length: '50' })

  await waitFor(() => {
    expect(sileo.error).toHaveBeenCalledWith({
      title: 'No pudimos guardar el tanque',
      description: 'Reintenta en un momento.',
    })
  })
  await settle()

  expect(sileo.success).not.toHaveBeenCalled()
  expect(selectedTank()).toBeNull()
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
  const busyButton = await screen.findByRole('button', { name: 'Guardando…' })
  expect(busyButton).toBeDisabled()
  fireEvent.click(busyButton)

  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalledTimes(1)
  })
  await settle()

  expect(await db.tanks.count()).toBe(1)
})

test('explains invalid dimensions next to each field and saves nothing', async () => {
  await fillAndSubmit({ capacity: '300', diameter: '', length: 'cincuenta' })

  expect(
    await screen.findByText('Debe estar entre 10 y 250 galones')
  ).toBeInTheDocument()
  expect(screen.getByText('Ingresa el diámetro')).toBeInTheDocument()
  expect(
    screen.getByText('Escribe solo números, por ejemplo 24.5')
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Capacidad')).toHaveAttribute(
    'aria-invalid',
    'true'
  )
  await settle()

  expect(await db.tanks.count()).toBe(0)
  expect(sileo.success).not.toHaveBeenCalled()
  expect(sileo.error).not.toHaveBeenCalled()
})

test('a duplicate offers to use the tank that already exists', async () => {
  const id = await db.tanks.add({ capacity: 80, diameter: 22, length: 50 })
  vi.mocked(sileo.action).mockReturnValueOnce('duplicate-notice')

  await fillAndSubmit({ capacity: '80', diameter: '22', length: '50' })

  await waitFor(() => {
    expect(sileo.action).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ya tienes ese tanque' })
    )
  })
  expect(await db.tanks.count()).toBe(1)
  expect(window.location.pathname).toBe('/tanques/crear')

  const [[notice]] = vi.mocked(sileo.action).mock.calls as [[SileoOptions]]
  notice.button?.onClick()

  await waitFor(() => {
    expect(window.location.pathname).toBe('/')
  })
  expect(sileo.dismiss).toHaveBeenCalledWith('duplicate-notice')
  expect(selectedTank()).toEqual({
    id,
    capacity: 80,
    diameter: 22,
    length: 50,
  })
})

// Regression: number inputs rejected decimal dimensions like 24.5
test('accepts decimal dimensions written with a comma', async () => {
  await fillAndSubmit({ capacity: '80', diameter: '24,5', length: '50' })

  await waitFor(() => {
    expect(sileo.success).toHaveBeenCalledWith({ title: 'Tanque agregado' })
  })
  const [saved] = await db.tanks.toArray()
  expect(saved).toMatchObject({ capacity: 80, diameter: 24.5, length: 50 })
})

test('"Cancelar" goes back to the list', async () => {
  await fill({ capacity: '', diameter: '', length: '' })

  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

  expect(window.location.pathname).toBe('/tanques')
})
