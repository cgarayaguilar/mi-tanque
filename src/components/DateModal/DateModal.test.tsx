import { fireEvent, render, screen } from '@testing-library/react'
import DateModal from 'components/DateModal'
import { PERIOD_SHORTCUTS } from 'components/DateModal/periodShortcuts'

const TODAY = new Date(2026, 9, 1, 10, 30)

const open = () => {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(
    <DateModal
      initialRange={{
        startDate: new Date(2026, 8, 24),
        endDate: new Date(2026, 9, 1, 23, 59, 59, 999),
      }}
      onSelect={onSelect}
      onClose={onClose}
    />
  )
  return { onSelect, onClose }
}

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

test('the shortcuts compute their periods from today', () => {
  const ranges = Object.fromEntries(
    PERIOD_SHORTCUTS.map(({ label, range }) => [label, range(TODAY)])
  )
  expect(ranges.Hoy).toEqual([
    new Date(2026, 9, 1),
    new Date(2026, 9, 1, 23, 59, 59, 999),
  ])
  expect(ranges['Últimos 7 días']?.[0]).toEqual(new Date(2026, 8, 24))
  expect(ranges['Últimos 30 días']?.[0]).toEqual(new Date(2026, 8, 1))
  expect(ranges['Este mes']?.[0]).toEqual(new Date(2026, 9, 1))
  expect(ranges['Mes pasado']).toEqual([
    new Date(2026, 8, 1),
    new Date(2026, 8, 30, 23, 59, 59, 999),
  ])
})

test('the current period shows as the active shortcut', () => {
  open()
  expect(
    screen.getByRole('button', { name: 'Últimos 7 días' })
  ).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
})

test('a shortcut, then Aplicar, chooses that period', () => {
  const { onSelect, onClose } = open()
  fireEvent.click(screen.getByRole('button', { name: 'Mes pasado' }))
  expect(screen.getByRole('button', { name: 'Mes pasado' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
  expect(onSelect).toHaveBeenCalledWith({
    startDate: new Date(2026, 8, 1),
    endDate: new Date(2026, 8, 30, 23, 59, 59, 999),
  })
  expect(onClose).toHaveBeenCalled()
})

test('Cancelar closes without changing the period', () => {
  const { onSelect, onClose } = open()
  fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(onSelect).not.toHaveBeenCalled()
  expect(onClose).toHaveBeenCalled()
})

test('the calendar is in Spanish', () => {
  open()
  expect(
    screen.getByRole('dialog', { name: 'Selecciona un periodo' })
  ).toHaveTextContent(/septiembre 2026/)
})
