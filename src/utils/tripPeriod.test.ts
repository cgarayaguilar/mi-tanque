import { tripPeriod } from 'utils/tripPeriod'

// backend specs/0025 CA-3: weeks from Monday to Sunday, on the phone's clock
describe('a trip period', () => {
  test('Monday at 00:30 and Sunday at 23:59 are the same week', () => {
    const monday = tripPeriod(new Date(2026, 9, 5, 0, 30))
    expect(monday).toEqual({
      year: 2026,
      month: 10,
      yearMonth: '2026-10',
      monthLabel: 'octubre 2026',
      weekStart: '2026-10-05',
      weekLabel: 'del 5 oct al 11 oct',
    })
    expect(tripPeriod(new Date(2026, 9, 11, 23, 59)).weekStart).toBe(
      '2026-10-05'
    )
  })

  test('Sunday the 4th is the week before, across two months', () => {
    expect(tripPeriod(new Date(2026, 9, 4, 12))).toMatchObject({
      month: 10,
      weekStart: '2026-09-28',
      weekLabel: 'del 28 sep al 4 oct',
    })
  })

  test('a week across the new year says both years', () => {
    expect(tripPeriod(new Date(2026, 0, 1, 9))).toMatchObject({
      year: 2026,
      month: 1,
      yearMonth: '2026-01',
      monthLabel: 'enero 2026',
      weekStart: '2025-12-29',
      weekLabel: 'del 29 dic 2025 al 4 ene 2026',
    })
  })
})
