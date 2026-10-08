import { differenceInCalendarDays } from 'date-fns'
import { fromPlainDate } from 'utils/plainDate'

// From a month before (backend specs/0011 RF-4)
const NOTICE_DAYS = 30
// The last week and after: shown prominently
const URGENT_DAYS = 7

export interface ExpiryNotice {
  text: string
  urgent: boolean
}

/** Kept for the insurance's callers (backend specs/0011). */
export type InsuranceNotice = ExpiryNotice

/** What expires: "Seguro" and "Seguro vencido", "Licencia" and "Licencia vencida". */
export interface ExpiryWords {
  name: string
  expired: string
}

/**
 * What a card says about a date that expires, counting calendar days on the
 * phone (specs/0011 RF-4, specs/0023 RF-9). Nothing without a date, more
 * than 30 days ahead, or for an archived item (RF-6).
 */
export const expiryNotice = (
  words: ExpiryWords,
  expiresOn: string | null,
  today: Date,
  archived = false
): ExpiryNotice | null => {
  const expiry = expiresOn === null ? null : fromPlainDate(expiresOn)
  if (archived || expiry === null) return null
  const days = differenceInCalendarDays(expiry, today)
  if (days > NOTICE_DAYS) return null
  if (days < 0) return { text: words.expired, urgent: true }
  if (days === 0) return { text: `${words.name} vence hoy`, urgent: true }
  if (days === 1) return { text: `${words.name} vence mañana`, urgent: true }
  return {
    text: `${words.name} vence en ${String(days)} días`,
    urgent: days <= URGENT_DAYS,
  }
}

/** The insurance of a truck or trailer (backend specs/0011). */
export const insuranceNotice = (
  expiresOn: string | null,
  today: Date,
  archived = false
) =>
  expiryNotice(
    { name: 'Seguro', expired: 'Seguro vencido' },
    expiresOn,
    today,
    archived
  )

/** A driver's license (backend specs/0023 RF-6). */
export const licenseNotice = (
  expiresOn: string | null,
  today: Date,
  archived = false
) =>
  expiryNotice(
    { name: 'Licencia', expired: 'Licencia vencida' },
    expiresOn,
    today,
    archived
  )
