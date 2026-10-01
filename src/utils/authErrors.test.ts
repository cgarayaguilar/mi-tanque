import {
  authErrorMessage,
  isCancelledSignIn,
  isWrongCode,
} from 'utils/authErrors'

const withCode = (code: string) => Object.assign(new Error(code), { code })

test('a closed Google window is not an error', () => {
  expect(isCancelledSignIn(withCode('auth/popup-closed-by-user'))).toBe(true)
  expect(isCancelledSignIn(withCode('auth/network-request-failed'))).toBe(false)
  expect(isCancelledSignIn('nope')).toBe(false)
})

test('wrong and expired codes are field errors', () => {
  expect(isWrongCode(withCode('auth/invalid-verification-code'))).toBe(true)
  expect(isWrongCode(withCode('auth/code-expired'))).toBe(true)
  expect(isWrongCode(withCode('auth/too-many-requests'))).toBe(false)
})

test.each([
  ['auth/code-expired', 'El código venció. Pide uno nuevo.'],
  [
    'auth/too-many-requests',
    'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  ],
  ['auth/operation-not-allowed', 'No podemos enviar SMS a ese país.'],
  [
    'functions/unavailable',
    'Sin conexión. Revisa tu señal e inténtalo de nuevo.',
  ],
  ['something/else', 'Algo salió mal. Inténtalo de nuevo.'],
])('%s has a message in the product voice', (code, message) => {
  expect(authErrorMessage(withCode(code))).toBe(message)
})
