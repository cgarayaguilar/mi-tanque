import { addDays, format, isSameYear, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { toPlainDate } from 'utils/plainDate'

/** A trip's year, month and week, for filters and reports (specs/0025 RF-1). */
export interface TripPeriod {
  year: number
  /** 1–12 */
  month: number
  /** 'AAAA-MM' */
  yearMonth: string
  /** "octubre 2026" */
  monthLabel: string
  /** The Monday of its week, 'AAAA-MM-DD'. */
  weekStart: string
  /** "del 5 oct al 11 oct"; with the years when the week crosses one. */
  weekLabel: string
}

/**
 * The period of a trip that starts at `start`, on the phone's clock: weeks
 * go from Monday to Sunday, as the owner's "del 5 oct al 11 oct".
 */
export const tripPeriod = (start: Date): TripPeriod => {
  const monday = startOfWeek(start, { weekStartsOn: 1 })
  const sunday = addDays(monday, 6)
  const day = (date: Date, withYear: boolean) =>
    format(date, withYear ? 'd MMM yyyy' : 'd MMM', { locale: es })
  const crossesYear = !isSameYear(monday, sunday)
  return {
    year: start.getFullYear(),
    month: start.getMonth() + 1,
    yearMonth: format(start, 'yyyy-MM'),
    monthLabel: format(start, 'MMMM yyyy', { locale: es }),
    weekStart: toPlainDate(monday),
    weekLabel: `del ${day(monday, crossesYear)} al ${day(sunday, crossesYear)}`,
  }
}
