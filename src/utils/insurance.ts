import { differenceInCalendarDays } from 'date-fns'
import { fromPlainDate } from 'utils/plainDate'

// From a month before (backend specs/0011 RF-4)
const NOTICE_DAYS = 30
// The last week and after: shown prominently
const URGENT_DAYS = 7

export interface InsuranceNotice {
  text: string
  urgent: boolean
}

/**
 * What the fleet card says about the insurance, counting calendar days on
 * the phone (RF-4). Nothing without a date, more than 30 days ahead, or for
 * an archived truck or trailer (RF-6).
 */
export const insuranceNotice = (
  expiresOn: string | null,
  today: Date,
  archived = false
): InsuranceNotice | null => {
  const expiry = expiresOn === null ? null : fromPlainDate(expiresOn)
  if (archived || expiry === null) return null
  const days = differenceInCalendarDays(expiry, today)
  if (days > NOTICE_DAYS) return null
  if (days < 0) return { text: 'Seguro vencido', urgent: true }
  if (days === 0) return { text: 'Seguro vence hoy', urgent: true }
  if (days === 1) return { text: 'Seguro vence mañana', urgent: true }
  return {
    text: `Seguro vence en ${String(days)} días`,
    urgent: days <= URGENT_DAYS,
  }
}
