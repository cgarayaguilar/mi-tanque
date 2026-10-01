interface ErrorContext {
  /** What was being attempted, e.g. 'createTank'. */
  operation: string
  /** Non-sensitive parameters that help reproduce it (never locations or personal data). */
  [detail: string]: unknown
}

// Single channel for unexpected errors (§7.2, §7.3). When the monitoring
// service is chosen (ENGINEERING_PRINCIPLES.md §0, open decision 3), report it here.
export const reportError = (error: unknown, context: ErrorContext): void => {
  console.error(`[${context.operation}]`, context, error)
}
