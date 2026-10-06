/** How long a screen waits for Firestore before saying so (backend specs/0020 RF-5). */
export const READ_TIMEOUT_MS = 15_000

/** A read that took too long: the screen shows its error and "Reintentar". */
export class SlowConnectionError extends Error {
  readonly code = 'deadline-exceeded'

  constructor(operation: string) {
    super(`${operation} took more than ${String(READ_TIMEOUT_MS / 1000)} s`)
    this.name = 'SlowConnectionError'
  }
}

let onSlowConnection: () => void = () => undefined

/**
 * Called each time a read runs out of time: services/firebase restarts
 * Firestore's connection there, so "Reintentar" does not wait on the hung one.
 */
export const setSlowConnectionHandler = (handler: () => void) => {
  onSlowConnection = handler
}

/**
 * The promise, or a SlowConnectionError after `ms`. On an installed iPhone
 * app Firestore's connection can hang without failing (specs/0020): the
 * screen waited forever. The read itself goes on and is simply ignored.
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  operation: string,
  ms = READ_TIMEOUT_MS
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new SlowConnectionError(operation))
      onSlowConnection()
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer)
  })
}

/** What a screen says when it could not load (specs/0020 RF-6). */
export const RETRY_HINT =
  'Tu conexión está lenta o se cortó. Revisa la señal y toca Reintentar.'
