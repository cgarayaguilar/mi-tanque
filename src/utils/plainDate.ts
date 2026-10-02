import { format, isValid } from 'date-fns'

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A calendar date without time, 'YYYY-MM-DD' (backend specs/0011 RF-1): no
 * time zone can move it to another day.
 */
export const toPlainDate = (date: Date) => format(date, 'yyyy-MM-dd')

/** The local date of a 'YYYY-MM-DD', or null if it is not a real date. */
export const fromPlainDate = (text: string): Date | null => {
  const match = PATTERN.exec(text)
  if (!match) return null
  const [, year, month, day] = match.map(Number) as [
    number,
    number,
    number,
    number,
  ]
  const date = new Date(year, month - 1, day)
  // 2026-02-31 rolls over to March: not a real date
  return isValid(date) &&
    date.getMonth() === month - 1 &&
    year >= 2000 &&
    year <= 2100
    ? date
    : null
}

export const isPlainDate = (text: string) => fromPlainDate(text) !== null
