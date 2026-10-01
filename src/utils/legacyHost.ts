/** The app moved here on 2026-10-01 (the old host had its own IndexedDB). */
export const CANONICAL_ORIGIN = 'https://solocamioneros.com'
const LEGACY_HOST = 'mi-tanque.vercel.app'

/**
 * Sends visitors of the old domain to the same path on the new one. The
 * server already redirects page loads (vercel.json); this covers installed
 * apps, whose service worker answers navigations without asking the server.
 * Returns true when it redirected, so nothing else should start.
 */
export const redirectFromLegacyHost = (
  location: Pick<
    Location,
    'hostname' | 'pathname' | 'search' | 'hash' | 'replace'
  > = window.location
): boolean => {
  if (location.hostname !== LEGACY_HOST) return false

  location.replace(
    `${CANONICAL_ORIGIN}${location.pathname}${location.search}${location.hash}`
  )
  return true
}
