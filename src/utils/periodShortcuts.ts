import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameYear,
  min,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import { es } from 'date-fns/locale'

// The calendar's quick periods (backend specs/0044 RF-1–RF-3), pure: the
// calendar only shows them

/** Weeks go Monday to Sunday, as in Viajes (specs/0025). */
const WEEK = { weekStartsOn: 1 } as const

export type PeriodRange = [Date, Date]

export interface PeriodShortcut {
  label: string
  /** Its whole days in the phone's time; it may pass today. */
  range: (today: Date) => PeriodRange
}

/** The quick periods, in the order shown (RF-1). */
export const PERIOD_SHORTCUTS: readonly PeriodShortcut[] = [
  {
    label: 'Esta semana',
    range: today => [startOfWeek(today, WEEK), endOfWeek(today, WEEK)],
  },
  {
    label: 'La semana pasada',
    range: today => {
      const last = subWeeks(today, 1)
      return [startOfWeek(last, WEEK), endOfWeek(last, WEEK)]
    },
  },
  {
    label: 'Este mes',
    range: today => [startOfMonth(today), endOfMonth(today)],
  },
  {
    label: 'El mes pasado',
    range: today => {
      const last = subMonths(today, 1)
      return [startOfMonth(last), endOfMonth(last)]
    },
  },
  {
    // 30 days, today included
    label: 'Los últimos 30 días',
    range: today => [startOfDay(subDays(today, 29)), endOfDay(today)],
  },
  {
    label: 'Los últimos 3 meses',
    range: today => [startOfDay(subMonths(today, 3)), endOfDay(today)],
  },
  {
    label: 'Los últimos 6 meses',
    range: today => [startOfDay(subMonths(today, 6)), endOfDay(today)],
  },
]

/**
 * A quick period as it applies: without future days (Historial, Gastos) it
 * ends today at the latest (RF-2); with them (Viajes), as it is (RF-3).
 */
export const shortcutRange = (
  shortcut: PeriodShortcut,
  today: Date,
  allowFuture: boolean
): PeriodRange => {
  const [start, end] = shortcut.range(today)
  return [start, allowFuture ? end : min([end, endOfDay(today)])]
}

const day = (date: Date, withYear: boolean) =>
  format(date, withYear ? 'd MMM yyyy' : 'd MMM', { locale: es })

/** "13 oct – 19 oct", "13 oct – hoy": under a quick period's name. */
export const shortcutDates = ([start, end]: PeriodRange, today: Date) => {
  const withYear = !isSameYear(start, end)
  return `${day(start, withYear)} – ${
    isSameDay(end, today) ? 'hoy' : day(end, withYear)
  }`
}

/**
 * "Del 14 sep al 13 oct de 2026 · 30 días": what is chosen (RF-7); the
 * year once, or on both ends when they differ.
 */
export const chosenText = ([start, end]: PeriodRange) => {
  const days = differenceInCalendarDays(end, start) + 1
  const count = days === 1 ? '1 día' : `${String(days)} días`
  if (isSameDay(start, end))
    return `El ${format(start, "d MMM 'de' yyyy", { locale: es })} · ${count}`
  const from = isSameYear(start, end)
    ? format(start, 'd MMM', { locale: es })
    : format(start, "d MMM 'de' yyyy", { locale: es })
  return `Del ${from} al ${format(end, "d MMM 'de' yyyy", { locale: es })} · ${count}`
}
