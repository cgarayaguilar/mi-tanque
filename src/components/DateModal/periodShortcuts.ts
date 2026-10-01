import {
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns'
import { defaultPeriod } from 'utils/period'

export interface PeriodShortcut {
  label: string
  range: (today: Date) => [Date, Date]
}

/** Quick periods above the calendar; "Últimos 7 días" is the default one. */
export const PERIOD_SHORTCUTS: readonly PeriodShortcut[] = [
  { label: 'Hoy', range: today => [startOfDay(today), endOfDay(today)] },
  {
    label: 'Últimos 7 días',
    range: today => {
      const { start, end } = defaultPeriod(today)
      return [start, end]
    },
  },
  {
    label: 'Últimos 30 días',
    range: today => [startOfDay(subDays(today, 30)), endOfDay(today)],
  },
  {
    label: 'Este mes',
    range: today => [startOfMonth(today), endOfDay(today)],
  },
  {
    label: 'Mes pasado',
    range: today => {
      const previous = subMonths(today, 1)
      return [startOfMonth(previous), endOfMonth(previous)]
    },
  },
]
