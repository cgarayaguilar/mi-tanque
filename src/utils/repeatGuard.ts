/**
 * The same save again this soon is a double tap, not a new measurement:
 * the first save is not awaited, so the button is free again at once
 * (backend ADR 0003). Measuring the same level later still saves.
 */
export const REPEAT_WINDOW_MS = 5_000

/** Answers true for a key seen within the window, and remembers the rest. */
export const createRepeatGuard = (windowMs = REPEAT_WINDOW_MS) => {
  let last: { key: string; at: number } | null = null
  return (key: string, now = Date.now()): boolean => {
    if (last?.key === key && now - last.at < windowMs) return true
    last = { key, at: now }
    return false
  }
}
