import { format, isSameYear } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Period } from 'types'

/** "23 sep – 30 sep 2026", with the year on both ends only when it changes. */
export const formatPeriod = ({ start, end }: Period): string =>
  isSameYear(start, end)
    ? `${format(start, 'd MMM', { locale: es })} – ${format(end, 'd MMM yyyy', { locale: es })}`
    : `${format(start, 'd MMM yyyy', { locale: es })} – ${format(end, 'd MMM yyyy', { locale: es })}`

/** "mar 30 sep, 14:05" */
export const formatMeasurementDate = (date: Date): string =>
  format(date, 'EEE d MMM, HH:mm', { locale: es })

const relative = new Intl.RelativeTimeFormat('es', {
  style: 'short',
  numeric: 'auto',
})

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "hace 5 min", "hace 2 h", "ayer", "hace 3 d"; past a month, the date. */
export const formatTimeAgo = (date: Date, now = new Date()): string => {
  const elapsed = Math.max(0, now.getTime() - date.getTime())
  if (elapsed < MINUTE) return 'hace un momento'
  if (elapsed < HOUR)
    return relative.format(-Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), 'hour')
  if (elapsed < 30 * DAY)
    return relative.format(-Math.floor(elapsed / DAY), 'day')
  return format(date, 'd MMM yyyy', { locale: es })
}
