interface ErrorContext {
  /** What was being attempted, e.g. 'createTank'. */
  operation: string
  /** Non-sensitive parameters that help reproduce it (never locations or personal data). */
  [detail: string]: unknown
}

// Errors also reach the server's logs (backend specs/0020 RF-8): a plain
// fetch to Vercel, which forwards it to the `clientErrors` function, so the
// Firebase SDK stays out of the basic mode's download
export const CLIENT_ERRORS_URL = '/api/client-errors'
export const MAX_REPORTS_PER_PAGE = 20
const STACK_LINES = 10
const CONTEXT_KEYS = 20

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const PHONE = /\+?\d[\d\s-]{6,}\d/g

/** Removes what looks like an email or a phone number (RF-9). */
export const scrub = (value: string) =>
  value.replace(EMAIL, '[correo]').replace(PHONE, '[teléfono]')

let sessionStatus: () => string | undefined = () => undefined

/** store/session tells which state the session is in, without an import cycle. */
export const setSessionStatusSource = (source: () => string | undefined) => {
  sessionStatus = source
}

const sent = new Set<string>()

/** Forgets what this page load sent. For tests. */
export const resetReportedErrors = () => {
  sent.clear()
}

const fieldOf = (error: unknown, field: string): unknown =>
  typeof error === 'object' && error !== null
    ? (error as Record<string, unknown>)[field]
    : undefined

const textOf = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined

/** Only the values the function takes: short text, numbers, flags. */
const cleanContext = (context: Omit<ErrorContext, 'operation'>) =>
  Object.fromEntries(
    Object.entries(context)
      .filter(
        ([key, value]) =>
          key.length <= 40 &&
          (value === null ||
            ['string', 'number', 'boolean'].includes(typeof value))
      )
      .slice(0, CONTEXT_KEYS)
      .map(([key, value]) => [
        key,
        typeof value === 'string' ? scrub(value).slice(0, 200) : value,
      ])
  )

/** Installed on the home screen: Android and desktop, or iOS Safari. */
const standalone = () => {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
  } catch {
    // Some browsers (and jsdom) have no matchMedia
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** The report sent: a closed list of fields, never the uid (RF-9). */
export const clientErrorReport = (
  error: unknown,
  { operation, ...context }: ErrorContext
) => {
  const message = error instanceof Error ? error.message : textOf(error)
  const stack = textOf(fieldOf(error, 'stack'))
  return {
    operation: operation.slice(0, 80),
    name: textOf(fieldOf(error, 'name'))?.slice(0, 80),
    code: textOf(fieldOf(error, 'code'))?.slice(0, 80),
    message: message === undefined ? undefined : scrub(message).slice(0, 500),
    stack:
      stack === undefined
        ? undefined
        : scrub(stack.split('\n').slice(0, STACK_LINES).join('\n')).slice(
            0,
            4000
          ),
    context: cleanContext(context),
    path: window.location.pathname.slice(0, 200),
    appVersion: __APP_VERSION__,
    online: navigator.onLine,
    sessionStatus: sessionStatus(),
    standalone: standalone(),
  }
}

/** Sends the report once per error and at most 20 per page (RF-10). */
export const sendClientError = (error: unknown, context: ErrorContext) => {
  try {
    const report = clientErrorReport(error, context)
    const key = `${report.operation}|${report.message ?? ''}`
    if (sent.has(key) || sent.size >= MAX_REPORTS_PER_PAGE) return
    sent.add(key)
    void fetch(CLIENT_ERRORS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // The error channel must not raise errors of its own (RF-11)
  }
}

// Single channel for unexpected errors (§7.2, §7.3): the console and, in
// production, the server's logs
export const reportError = (error: unknown, context: ErrorContext): void => {
  console.error(`[${context.operation}]`, context, error)
  if (import.meta.env.PROD) sendClientError(error, context)
}
