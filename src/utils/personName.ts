import { NAME_MAX, NAME_MIN } from 'schemas/account'

/**
 * A name as the account keeps it: single spaces, at most 60 characters, at
 * least 2. Google may bring a longer one, and the rules hold the
 * measurements' `userName` to 60 (the backend's `tokenName` does the same).
 * Null when there is none worth showing.
 */
export const usableName = (name: string | null | undefined): string | null => {
  const clean = name?.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim()
  return clean && clean.length >= NAME_MIN ? clean : null
}

/** The author's name on what they save; never empty (the rules ask 1–60). */
export const authorName = (name: string | null | undefined) =>
  usableName(name) ?? 'Sin nombre'
