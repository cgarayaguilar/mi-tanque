import { insuranceNotice } from 'utils/insurance'

const TODAY = new Date(2026, 9, 2, 18, 30)

// specs/0011 CA-3
test.each([
  ['2026-11-02', null],
  ['2026-11-01', { text: 'Seguro vence en 30 días', urgent: false }],
  ['2026-10-10', { text: 'Seguro vence en 8 días', urgent: false }],
  ['2026-10-09', { text: 'Seguro vence en 7 días', urgent: true }],
  ['2026-10-03', { text: 'Seguro vence mañana', urgent: true }],
  ['2026-10-02', { text: 'Seguro vence hoy', urgent: true }],
  ['2026-10-01', { text: 'Seguro vencido', urgent: true }],
])('expiring on %s says %j', (expiresOn, notice) => {
  expect(insuranceNotice(expiresOn, TODAY)).toEqual(notice)
})

test('nothing without a date, with a bad one, or when archived', () => {
  expect(insuranceNotice(null, TODAY)).toBeNull()
  expect(insuranceNotice('2026-02-31', TODAY)).toBeNull()
  expect(insuranceNotice('2026-10-01', TODAY, true)).toBeNull()
})
