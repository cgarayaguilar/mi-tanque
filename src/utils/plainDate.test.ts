import { fromPlainDate, isPlainDate, toPlainDate } from 'utils/plainDate'

test('a date without time goes and comes back the same day', () => {
  const date = new Date(2026, 10, 15, 23, 59)
  expect(toPlainDate(date)).toBe('2026-11-15')
  expect(fromPlainDate('2026-11-15')).toEqual(new Date(2026, 10, 15))
})

test('only real dates between 2000 and 2100', () => {
  expect(isPlainDate('2026-02-28')).toBe(true)
  expect(isPlainDate('2026-02-31')).toBe(false)
  expect(isPlainDate('1999-12-31')).toBe(false)
  expect(isPlainDate('15/11/2026')).toBe(false)
  expect(isPlainDate('invalid')).toBe(false)
})
