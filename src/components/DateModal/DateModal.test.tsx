import { fireEvent, render, screen, within } from '@testing-library/react'
import DateModal from 'components/DateModal'

// backend specs/0044: Tuesday 13 October 2026
const TODAY = new Date(2026, 9, 13, 10, 30)

const open = (allowFuture = false) => {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(
    <DateModal
      initialRange={{
        startDate: new Date(2026, 8, 14),
        endDate: new Date(2026, 9, 13, 23, 59, 59, 999),
      }}
      onSelect={onSelect}
      onClose={onClose}
      allowFuture={allowFuture}
    />
  )
  return { onSelect, onClose }
}

const shortcut = (name: string) =>
  within(screen.getByRole('group', { name: 'Periodos rápidos' })).getByRole(
    'button',
    { name: new RegExp(`^${name}`) }
  )

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TODAY)
  // Without the license (tests, previews) MUI X logs a watermark notice
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('the seven quick periods, each with its dates; the current one marked', () => {
  open()
  const group = screen.getByRole('group', { name: 'Periodos rápidos' })
  expect(
    within(group)
      .getAllByRole('button')
      .map(button => button.textContent)
  ).toEqual([
    'Esta semana12 oct – hoy',
    'La semana pasada5 oct – 11 oct',
    'Este mes1 oct – hoy',
    'El mes pasado1 sep – 30 sep',
    'Los últimos 30 días14 sep – hoy',
    'Los últimos 3 meses13 jul – hoy',
    'Los últimos 6 meses13 abr – hoy',
  ])
  expect(shortcut('Los últimos 30 días')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(shortcut('Esta semana')).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('status')).toHaveTextContent(
    'Del 14 sep al 13 oct de 2026 · 30 días'
  )
})

test('a quick period, then Aplicar, chooses it (RF-9)', () => {
  const { onSelect, onClose } = open()
  fireEvent.click(shortcut('El mes pasado'))
  expect(shortcut('El mes pasado')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('status')).toHaveTextContent(
    'Del 1 sep al 30 sep de 2026 · 30 días'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
  expect(onSelect).toHaveBeenCalledWith({
    startDate: new Date(2026, 8, 1),
    endDate: new Date(2026, 8, 30, 23, 59, 59, 999),
  })
  expect(onClose).toHaveBeenCalled()
})

test('in Viajes the week goes to Sunday, and future days can be chosen (CA-2)', () => {
  const { onSelect } = open(true)
  expect(shortcut('Esta semana')).toHaveTextContent('12 oct – 18 oct')
  expect(shortcut('Este mes')).toHaveTextContent('1 oct – 31 oct')
  fireEvent.click(shortcut('Esta semana'))
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
  expect(onSelect).toHaveBeenCalledWith({
    startDate: new Date(2026, 9, 12),
    endDate: new Date(2026, 9, 18, 23, 59, 59, 999),
  })
})

test('without future days, a day after today cannot be chosen', () => {
  open()
  fireEvent.click(shortcut('Esta semana'))
  // September and October are shown: October's 20 is after today
  const twentieths = screen.getAllByRole('gridcell', { name: '20' })
  expect(twentieths.at(-1)).toBeDisabled()
  expect(twentieths[0]).toBeEnabled()
})

test('Cancelar and the × close without changing the period', () => {
  const { onSelect, onClose } = open()
  fireEvent.click(shortcut('La semana pasada'))
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(onSelect).not.toHaveBeenCalled()
  expect(onClose).toHaveBeenCalledTimes(2)
})

test('the calendar is in Spanish and shows the last month of the period', () => {
  open()
  const dialog = screen.getByRole('dialog', { name: 'Elige el periodo' })
  expect(dialog).toHaveTextContent(/octubre 2026/)
})

test('after a quick period, a day tapped starts a new period', () => {
  const { onSelect } = open()
  fireEvent.click(shortcut('La semana pasada'))
  const [, october] = screen.getAllByRole('grid')
  fireEvent.click(
    within(october as HTMLElement).getByRole('gridcell', { name: '2' })
  )
  expect(screen.getByRole('status')).toHaveTextContent('Elige el último día')
  expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled()
  fireEvent.click(
    within(october as HTMLElement).getByRole('gridcell', { name: '8' })
  )
  expect(screen.getByRole('status')).toHaveTextContent(
    'Del 2 oct al 8 oct de 2026 · 7 días'
  )
  expect(shortcut('La semana pasada')).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
  expect(onSelect).toHaveBeenCalledWith({
    startDate: new Date(2026, 9, 2),
    endDate: new Date(2026, 9, 8, 23, 59, 59, 999),
  })
})
