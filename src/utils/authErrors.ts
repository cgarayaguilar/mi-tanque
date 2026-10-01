/** Error codes from Firebase Auth and callable functions (`auth/…`, `functions/…`). */
const errorCode = (error: unknown): string | null =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  typeof error.code === 'string'
    ? error.code
    : null

/** The user closed or replaced the Google window: not an error to show. */
export const isCancelledSignIn = (error: unknown) => {
  const code = errorCode(error)
  return (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/user-cancelled'
  )
}

export const isWrongCode = (error: unknown) => {
  const code = errorCode(error)
  return (
    code === 'auth/invalid-verification-code' ||
    code === 'auth/code-expired' ||
    code === 'auth/missing-verification-code'
  )
}

/** What to tell the user (voice: tú, §9). */
export const authErrorMessage = (error: unknown): string => {
  switch (errorCode(error)) {
    case 'auth/invalid-verification-code':
    case 'auth/missing-verification-code':
      return 'El código no es correcto. Revísalo e inténtalo de nuevo.'
    case 'auth/code-expired':
      return 'El código venció. Pide uno nuevo.'
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.'
    case 'auth/invalid-phone-number':
    case 'auth/missing-phone-number':
      return 'Revisa el número de teléfono.'
    case 'auth/operation-not-allowed':
    case 'auth/unsupported-first-factor':
      return 'No podemos enviar SMS a ese país.'
    case 'auth/network-request-failed':
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
    case 'unavailable':
      return 'Sin conexión. Revisa tu señal e inténtalo de nuevo.'
    case 'auth/user-disabled':
      return 'Esta cuenta está desactivada.'
    default:
      return 'Algo salió mal. Inténtalo de nuevo.'
  }
}
