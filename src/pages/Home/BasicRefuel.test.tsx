import {
  within,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import { db } from 'services/db'
import { useSelectedTankStore } from 'store/selectedTank'
import { choose } from '../../testing/choose'

const tank = { capacity: 50, diameter: 25, length: 26 }

const chooseTank = async () => {
  const id = await db.tanks.add(tank)
  window.localStorage.setItem('defaultTank', JSON.stringify({ id, ...tank }))
  useSelectedTankStore.getState().rehydrate()
  return id
}

const openRefuel = async () => {
  window.history.pushState({}, '', '/')
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Rellenar' }))
  return screen.findByRole('form', { name: 'Nuevo relleno' })
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

beforeEach(async () => {
  window.localStorage.clear()
  await db.tanks.clear()
  await db.measurements.clear()
  await db.refuels.clear()
})

afterEach(() => {
  vi.clearAllMocks()
})

test('without an account the currency must be chosen every time (specs/0006 CA-2)', async () => {
  await chooseTank()
  await openRefuel()
  type('Cantidad echada', '50')
  type('Precio', '30')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar relleno' }))
  expect(await screen.findByText('Elige la moneda')).toBeInTheDocument()
  expect(await db.refuels.count()).toBe(0)
})

test('computes live and saves the refuel on this phone (CA-1, CA-2)', async () => {
  const tankId = await chooseTank()
  await db.measurements.add({
    date: new Date(Date.now() - 60_000),
    inches: 10,
    gallons: '20.00',
    liters: '75.71',
    location: 'Sin ubicación',
    tankId,
  })
  await openRefuel()
  type('Cantidad echada', '50')
  type('Precio', '30')
  await choose('Moneda', 'Córdobas nicaragüenses (C$)')
  type('Gasolinera (opcional)', 'Puma Km 7')

  expect(screen.getByText('13.21 gal')).toBeInTheDocument()
  // specs/0012 CA-2, CA-3: symbol first, code only on the total, litros
  expect(screen.getByText('C$1,500.00 NIO')).toBeInTheDocument()
  expect(screen.getByText('C$113.56/gal · C$30.00/litro')).toBeInTheDocument()
  expect(screen.getByText('50.00 litros')).toBeInTheDocument()
  expect(screen.getByLabelText('Precio').parentElement).toHaveTextContent(
    /^C\$/
  )
  expect(
    await screen.findByText(/"antes" es la última lectura \(20.00 gal\)/)
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Guardar relleno' }))
  await waitFor(async () => {
    expect(await db.refuels.count()).toBe(1)
  })
  const [saved] = await db.refuels.toArray()
  expect(saved).toMatchObject({
    tankId,
    gallonsAdded: 13.21,
    litersAdded: 50,
    currency: 'NIO',
    pricePerLiter: 30,
    pricePerGallon: 113.56,
    total: 1500,
    gallonsBefore: 20,
    gallonsAfter: 33.21,
    stationName: 'Puma Km 7',
  })
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Relleno guardado' })
  expect(
    await screen.findByText(/Antes 20.00 gal .* → Después 33.21 gal/)
  ).toBeInTheDocument()
})

test('the invoice total can be corrected, and inches give the levels (RF-2, RF-3)', async () => {
  await chooseTank()
  await openRefuel()
  type('Cantidad echada', '50')
  type('Precio', '30')
  await choose('Moneda', 'Córdobas nicaragüenses (C$)')
  fireEvent.click(screen.getByRole('button', { name: 'Corregir total' }))
  type('Total de la factura (opcional)', '1,499.50')
  // specs/0012 RF-8, RF-9: the level card shows what the inches mean
  const level = screen.getByRole('group', { name: 'Nivel del tanque' })
  expect(level).toHaveTextContent('Antes—Después—')
  type('Antes (opcional)', '5')
  type('Después (opcional)', '15')
  expect(within(level).getAllByText(/litros · \d+\s%\slleno/)).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Guardar relleno' }))
  await waitFor(async () => {
    expect(await db.refuels.count()).toBe(1)
  })
  const [saved] = await db.refuels.toArray()
  expect(saved?.total).toBe(1499.5)
  expect(saved?.inchesBefore).toBe(5)
  expect(saved?.inchesAfter).toBe(15)
  expect(saved?.gallonsAfter).toBeGreaterThan(saved?.gallonsBefore ?? 999)
})

test('switching back to Medir shows the measurement form', async () => {
  await chooseTank()
  await openRefuel()
  fireEvent.click(screen.getByRole('button', { name: 'Medir' }))
  expect(
    await screen.findByLabelText('Pulgadas de combustible')
  ).toBeInTheDocument()
})
