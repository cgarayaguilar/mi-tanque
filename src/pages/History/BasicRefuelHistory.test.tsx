import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import { db } from 'services/db'
import { useHistoryStore } from 'store/history'
import type { NewLocalRefuel } from 'types'

const DAY = 24 * 60 * 60 * 1000

const refuel = (
  tankId: number,
  overrides: Partial<NewLocalRefuel> = {}
): NewLocalRefuel => ({
  intentId: crypto.randomUUID(),
  date: new Date(Date.now() - DAY),
  tankId,
  gallonsAdded: 13.21,
  litersAdded: 50,
  quantityUnit: 'liter',
  currency: 'NIO',
  priceUnit: 'liter',
  pricePerGallon: 113.56,
  pricePerLiter: 30,
  total: 1500,
  inchesBefore: null,
  inchesAfter: null,
  gallonsBefore: 20,
  gallonsAfter: 33.21,
  fillPercentBefore: 40,
  fillPercentAfter: 66.4,
  stationName: 'Puma Km 7',
  ...overrides,
})

const openRefuels = async () => {
  window.history.pushState({}, '', '/history')
  render(<App />)
  fireEvent.click(await screen.findByRole('tab', { name: 'Rellenos' }))
}

beforeEach(async () => {
  window.localStorage.clear()
  useHistoryStore.setState({
    chosenPeriod: null,
    status: 'idle',
    histories: [],
  })
  await db.tanks.clear()
  await db.measurements.clear()
  await db.refuels.clear()
})

afterEach(() => {
  vi.clearAllMocks()
})

test('an empty period invites to refuel from Medición (RF-7)', async () => {
  await openRefuels()
  expect(
    await screen.findByRole('heading', { name: 'Sin rellenos en este periodo' })
  ).toBeInTheDocument()
})

test('summarizes the period per currency and lists the refuels (RF-8, RF-10)', async () => {
  const tankId = await db.tanks.add({ capacity: 50, diameter: 25, length: 26 })
  await db.refuels.bulkAdd([
    refuel(tankId),
    refuel(tankId, {
      date: new Date(Date.now() - 2 * DAY),
      currency: 'USD',
      quantityUnit: 'gallon',
      priceUnit: 'gallon',
      gallonsAdded: 20,
      litersAdded: 75.71,
      pricePerGallon: 4,
      pricePerLiter: 1.06,
      total: 80,
      stationName: null,
    }),
  ])
  await openRefuels()

  const summary = await screen.findByRole('region', {
    name: 'Resumen del periodo',
  })
  expect(summary).toHaveTextContent('33,21 gal')
  expect(summary).toHaveTextContent('Gastado en NIONIO 1500,00')
  expect(summary).toHaveTextContent('Gastado en USDUSD 80,00')

  const rows = within(
    screen.getByRole('list', { name: 'Rellenos' })
  ).getAllByRole('listitem')
  expect(rows[0]).toHaveTextContent('50,00 L (13,21 gal)')
  expect(rows[0]).toHaveTextContent('Tanque de 50 gal')
  expect(rows[0]).toHaveTextContent(
    'Antes 20,00 gal (40 %) → Después 33,21 gal (66 %)'
  )
  expect(rows[0]).toHaveTextContent('Puma Km 7')
  expect(rows[1]).toHaveTextContent('20,00 gal (75,71 L)')
})

test('a refuel is corrected and deleted on this phone (RF-11)', async () => {
  const tankId = await db.tanks.add({ capacity: 50, diameter: 25, length: 26 })
  await db.refuels.add(refuel(tankId))
  await openRefuels()

  fireEvent.click(
    await screen.findByRole('button', { name: /Opciones del relleno/ })
  )
  fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))
  const dialog = screen.getByRole('dialog', { name: 'Corregir relleno' })
  expect(within(dialog).getByLabelText('Cantidad echada')).toHaveValue('50')
  fireEvent.change(within(dialog).getByLabelText('Precio'), {
    target: { value: '31' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
  await waitFor(async () => {
    expect((await db.refuels.toArray())[0]?.total).toBe(1550)
  })
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Relleno corregido' })
  // "Before" stays the level when the refuel happened
  expect((await db.refuels.toArray())[0]?.gallonsBefore).toBe(20)

  fireEvent.click(
    await screen.findByRole('button', { name: /Opciones del relleno/ })
  )
  fireEvent.click(screen.getByRole('menuitem', { name: 'Borrar' }))
  fireEvent.click(
    within(
      screen.getByRole('dialog', { name: '¿Borrar este relleno?' })
    ).getByRole('button', {
      name: 'Borrar',
    })
  )
  await waitFor(async () => {
    expect(await db.refuels.count()).toBe(0)
  })
  expect(sileo.success).toHaveBeenCalledWith({ title: 'Relleno borrado' })
})
