import { endOfDay, startOfDay, subDays } from 'date-fns'
import type { Period } from 'types'

// Pure date helpers for a list's period. Kept apart from the stores so
// the calendar (a lazy chunk) can use them without pulling in IndexedDB.

/**
 * The period a list opens with: the last 30 days, today included (backend
 * specs/0044 RF-6), as "Los últimos 30 días" of the calendar.
 */
export const defaultPeriod = (now = new Date()): Period => ({
  start: startOfDay(subDays(now, 29)),
  end: endOfDay(now),
})

/** Whole days, so the last day includes its final hours. */
export const toWholeDays = ({ start, end }: Period): Period => ({
  start: startOfDay(start),
  end: endOfDay(end),
})
