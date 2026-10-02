const KEY = 'chunkReloadAt'
// A second failure this soon is not an old chunk: leave it to ErrorBoundary
const RETRY_AFTER_MS = 30_000

/**
 * After a deploy, a tab can ask for a chunk of the version before, which the
 * server no longer has (vite:preloadError). Reloading brings the new version;
 * once, so a real outage does not loop (audit 2026-10-01).
 */
export const reloadOnOldChunks = (now = () => Date.now()) => {
  window.addEventListener('vite:preloadError', event => {
    let last = 0
    try {
      last = Number(sessionStorage.getItem(KEY) ?? 0)
    } catch {
      // Without storage, reload anyway: a loop needs it to fail again
    }
    if (now() - last < RETRY_AFTER_MS) return
    try {
      sessionStorage.setItem(KEY, String(now()))
    } catch {
      // Nothing to remember
    }
    event.preventDefault()
    window.location.reload()
  })
}
