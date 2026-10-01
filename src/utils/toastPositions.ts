import type { SileoOptions, SileoPosition } from 'sileo'

/** Toasts sit at the bottom, above the navigation (DESIGN.md)… */
export const TOAST_POSITION: SileoPosition = 'bottom-center'
/** …except errors: at the top, centered, where they cannot be missed. */
export const ERROR_TOAST_POSITION: SileoPosition = 'top-center'

type Show = (options: SileoOptions) => string

interface Toasts {
  success: Show
  error: Show
  warning: Show
  info: Show
  action: Show
}

const KINDS = ['success', 'error', 'warning', 'info', 'action'] as const

/**
 * Gives every toast its place, unless a call asks for another. Each kind
 * needs it: Sileo reuses one toast, and a toast without a position takes the
 * one it replaces, so a success after an error would stay at the top. Called
 * once, at start-up, so the call sites stay as they are.
 */
export const placeToasts = (toasts: Toasts) => {
  for (const kind of KINDS) {
    const show = toasts[kind].bind(toasts)
    const position = kind === 'error' ? ERROR_TOAST_POSITION : TOAST_POSITION
    toasts[kind] = options => show({ position, ...options })
  }
}
