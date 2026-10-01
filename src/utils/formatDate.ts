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
