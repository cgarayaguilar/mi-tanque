import {
  chosenText,
  PERIOD_SHORTCUTS,
  shortcutDates,
  shortcutRange,
} from 'utils/periodShortcuts'
import { defaultPeriod } from 'utils/period'

// backend specs/0044 RF-1–RF-3, RF-6, RNF-1

const endOf = (year: number, month: number, day: number) =>
  new Date(year, month, day, 23, 59, 59, 999)

const ranges = (today: Date, allowFuture: boolean) =>
  Object.fromEntries(
    PERIOD_SHORTCUTS.map(shortcut => [
      shortcut.label,
      shortcutRange(shortcut, today, allowFuture),
    ])
  )

test('the seven, in their order', () => {
  expect(PERIOD_SHORTCUTS.map(shortcut => shortcut.label)).toEqual([
    'Esta semana',
    'La semana pasada',
    'Este mes',
    'El mes pasado',
    'Los últimos 30 días',
    'Los últimos 3 meses',
    'Los últimos 6 meses',
  ])
})

describe('on Tuesday 13 October 2026', () => {
  const TUESDAY = new Date(2026, 9, 13, 10, 30)

  test('without future days, each ends today at the latest (CA-1)', () => {
    const periods = ranges(TUESDAY, false)
    expect(periods['Esta semana']).toEqual([
      new Date(2026, 9, 12),
      endOf(2026, 9, 13),
    ])
    expect(periods['La semana pasada']).toEqual([
      new Date(2026, 9, 5),
      endOf(2026, 9, 11),
    ])
    expect(periods['Este mes']).toEqual([
      new Date(2026, 9, 1),
      endOf(2026, 9, 13),
    ])
    expect(periods['El mes pasado']).toEqual([
      new Date(2026, 8, 1),
      endOf(2026, 8, 30),
    ])
    expect(periods['Los últimos 30 días']).toEqual([
      new Date(2026, 8, 14),
      endOf(2026, 9, 13),
    ])
    expect(periods['Los últimos 3 meses']?.[0]).toEqual(new Date(2026, 6, 13))
    expect(periods['Los últimos 6 meses']?.[0]).toEqual(new Date(2026, 3, 13))
  })

  test('with them (Viajes), the week to Sunday and the month to its end (CA-2)', () => {
    const periods = ranges(TUESDAY, true)
    expect(periods['Esta semana']).toEqual([
      new Date(2026, 9, 12),
      endOf(2026, 9, 18),
    ])
    expect(periods['Este mes']).toEqual([
      new Date(2026, 9, 1),
      endOf(2026, 9, 31),
    ])
    expect(periods['Los últimos 30 días']?.[1]).toEqual(endOf(2026, 9, 13))
  })

  test('the default period is the last 30 days (RF-6)', () => {
    expect(defaultPeriod(TUESDAY)).toEqual({
      start: new Date(2026, 8, 14),
      end: endOf(2026, 9, 13),
    })
  })
})

test('on a Sunday, this week is the one ending that day', () => {
  const SUNDAY = new Date(2026, 9, 18, 20, 0)
  expect(ranges(SUNDAY, false)['Esta semana']).toEqual([
    new Date(2026, 9, 12),
    endOf(2026, 9, 18),
  ])
  expect(ranges(SUNDAY, false)['La semana pasada']).toEqual([
    new Date(2026, 9, 5),
    endOf(2026, 9, 11),
  ])
})

test('in March, last month is February, leap year or not', () => {
  expect(ranges(new Date(2028, 2, 10), false)['El mes pasado']).toEqual([
    new Date(2028, 1, 1),
    endOf(2028, 1, 29),
  ])
  expect(ranges(new Date(2026, 2, 31), false)['El mes pasado']).toEqual([
    new Date(2026, 1, 1),
    endOf(2026, 1, 28),
  ])
  // 31 May minus 3 months: the last day of February
  expect(
    ranges(new Date(2026, 4, 31), false)['Los últimos 3 meses']?.[0]
  ).toEqual(new Date(2026, 1, 28))
})

describe('their texts', () => {
  const TODAY = new Date(2026, 9, 13, 10, 30)

  test('under each name: its dates, "hoy" when it ends today', () => {
    expect(
      shortcutDates([new Date(2026, 9, 6), endOf(2026, 9, 12)], TODAY)
    ).toBe('6 oct – 12 oct')
    expect(
      shortcutDates([new Date(2026, 8, 14), endOf(2026, 9, 13)], TODAY)
    ).toBe('14 sep – hoy')
    expect(
      shortcutDates([new Date(2025, 11, 1), endOf(2026, 0, 31)], TODAY)
    ).toBe('1 dic 2025 – 31 ene 2026')
  })

  test('what is chosen, with its days', () => {
    expect(chosenText([new Date(2026, 8, 14), endOf(2026, 9, 13)])).toBe(
      'Del 14 sep al 13 oct de 2026 · 30 días'
    )
    expect(chosenText([new Date(2026, 9, 13), endOf(2026, 9, 13)])).toBe(
      'El 13 oct de 2026 · 1 día'
    )
    expect(chosenText([new Date(2025, 11, 20), endOf(2026, 0, 10)])).toBe(
      'Del 20 dic de 2025 al 10 ene de 2026 · 22 días'
    )
  })
})
