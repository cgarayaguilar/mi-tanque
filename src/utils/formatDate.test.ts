import { formatMeasurementDate, formatPeriod } from 'utils/formatDate'

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
