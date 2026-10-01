import { endOfDay, startOfDay, subDays } from 'date-fns'
import type { Period } from 'types'

// Pure date helpers for the history's period. Kept apart from the stores so
// the calendar (a lazy chunk) can use them without pulling in IndexedDB.

/** The last week, through the end of today. */
export const defaultPeriod = (now = new Date()): Period => ({
  start: startOfDay(subDays(now, 7)),
  end: endOfDay(now),
})

/** Whole days, so the last day includes its final hours. */
export const toWholeDays = ({ start, end }: Period): Period => ({
  start: startOfDay(start),
  end: endOfDay(end),
})
