import { format, isValid } from 'date-fns'

/** A date and time as the form holds it: 'AAAA-MM-DDTHH:mm', '' or 'invalid'. */
export const toDateTimeValue = (date: Date) =>
  format(date, "yyyy-MM-dd'T'HH:mm")

export const fromDateTimeValue = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(value)
  return isValid(date) ? date : null
}
