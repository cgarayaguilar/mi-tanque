import {
  formatMeasurementDate,
  formatPeriod,
  formatTimeAgo,
} from 'utils/formatDate'

test('formatPeriod repeats the year only when it changes', () => {
  expect(
    formatPeriod({ start: new Date(2026, 8, 23), end: new Date(2026, 8, 30) })
  ).toBe('23 sep – 30 sep 2026')
  expect(
    formatPeriod({ start: new Date(2025, 11, 28), end: new Date(2026, 0, 3) })
  ).toBe('28 dic 2025 – 3 ene 2026')
})

test('formatMeasurementDate shows weekday, day, month and time', () => {
  expect(formatMeasurementDate(new Date(2026, 8, 30, 14, 5))).toBe(
    'mié 30 sep, 14:05'
  )
})

test('formatTimeAgo reads like a person and falls back to the date', () => {
  const now = new Date(2026, 9, 1, 12, 0)
  const ago = (ms: number) => formatTimeAgo(new Date(now.getTime() - ms), now)
  expect(ago(20_000)).toBe('hace un momento')
  expect(ago(5 * 60_000)).toBe('hace 5 min')
  expect(ago(2 * 3_600_000 + 59 * 60_000)).toBe('hace 2 h')
  expect(ago(30 * 3_600_000)).toBe('ayer')
  expect(ago(3 * 86_400_000)).toBe('hace 3 d')
  expect(ago(40 * 86_400_000)).toBe('22 ago 2026')
  // A phone clock slightly ahead never shows the future
  expect(ago(-60_000)).toBe('hace un momento')
})
