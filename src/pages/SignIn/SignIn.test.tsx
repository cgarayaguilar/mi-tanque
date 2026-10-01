import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import { useSessionStore } from 'store/session'

const api = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(() => Promise.resolve()),
  sendPhoneCode: vi.fn(),
  warmUpAccount: vi.fn(),
}))
vi.mock('services/session', () => api)

const confirm = vi.fn(() => Promise.resolve())

const renderSignIn = () => {
  window.history.pushState({}, '', '/entrar')
  render(<App />)
}

const authError = (code: string) => Object.assign(new Error(code), { code })

beforeEach(() => {
  useSessionStore.setState({
    status: 'signedOut',
    user: null,
    start: () => Promise.resolve(),
  })
  api.sendPhoneCode.mockResolvedValue({ confirm })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

const choosePhone = async (country: string, number: string) => {
  fireEvent.change(await screen.findByLabelText('País'), {
    target: { value: country },
  })
  fireEvent.change(screen.getByLabelText('Número de teléfono'), {
    target: { value: number },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
}

test('the app bar offers to sign in without a session (specs/0002 RF-1)', async () => {
  window.history.pushState({}, '', '/')
  render(<App />)

  fireEvent.click(await screen.findByRole('button', { name: 'Entrar' }))

  expect(window.location.pathname).toBe('/entrar')
})

test('Google sign-in starts from its button; a closed window is no error', async () => {
  api.signInWithGoogle.mockRejectedValueOnce(
    authError('auth/popup-closed-by-user')
  )
  renderSignIn()

  fireEvent.click(
    await screen.findByRole('button', { name: 'Continuar con Google' })
  )

  await waitFor(() => {
    expect(api.signInWithGoogle).toHaveBeenCalled()
  })
  expect(sileo.error).not.toHaveBeenCalled()
})

test('a Google failure is explained with a toast', async () => {
  api.signInWithGoogle.mockRejectedValueOnce(
    authError('auth/network-request-failed')
  )
  renderSignIn()

  fireEvent.click(
    await screen.findByRole('button', { name: 'Continuar con Google' })
  )

  await waitFor(() => {
    expect(sileo.error).toHaveBeenCalledWith({
      title: 'No pudimos iniciar sesión',
      description: 'Sin conexión. Revisa tu señal e inténtalo de nuevo.',
    })
  })
})

test('a number with the wrong length for its country is flagged next to the field (CA-3)', async () => {
  renderSignIn()

  await choosePhone('NI', '8888 777')

  expect(
    await screen.findByText(
      'Revisa el número: no tiene los dígitos de ese país'
    )
  ).toBeInTheDocument()
  expect(api.sendPhoneCode).not.toHaveBeenCalled()
})

test('sends the code to the number in international format', async () => {
  renderSignIn()

  await choosePhone('NI', '8888-7777')

  await waitFor(() => {
    expect(api.sendPhoneCode).toHaveBeenCalledWith(
      '+50588887777',
      expect.any(HTMLElement)
    )
  })
  expect(
    await screen.findByText(/Escribe el código que enviamos por SMS/)
  ).toHaveTextContent('+50588887777')
})

test('a wrong code is explained next to the field and can be retried (CA-3)', async () => {
  confirm.mockRejectedValueOnce(authError('auth/invalid-verification-code'))
  renderSignIn()
  await choosePhone('MX', '55 1234 5678')

  const code = await screen.findByLabelText('Código')
  fireEvent.change(code, { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verificar' }))

  expect(
    await screen.findByText(
      'El código no es correcto. Revísalo e inténtalo de nuevo.'
    )
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Verificar' }))
  await waitFor(() => {
    expect(confirm).toHaveBeenCalledTimes(2)
  })
})

test('the code must be 6 digits before it is checked', async () => {
  renderSignIn()
  await choosePhone('MX', '5512345678')

  fireEvent.change(await screen.findByLabelText('Código'), {
    target: { value: '12a' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Verificar' }))

  expect(
    await screen.findByText('Escribe los 6 números del código')
  ).toBeInTheDocument()
  expect(confirm).not.toHaveBeenCalled()
})

test('resending waits 60 seconds and changing the number goes back', async () => {
  renderSignIn()
  await choosePhone('MX', '5512345678')

  expect(
    await screen.findByRole('button', { name: /Reenviar código en \d+ s/ })
  ).toBeDisabled()

  fireEvent.click(screen.getByRole('button', { name: 'Cambiar número' }))
  expect(await screen.findByLabelText('Número de teléfono')).toBeInTheDocument()
})

test('once signed in, a new user goes to the welcome screen', async () => {
  renderSignIn()
  await screen.findByRole('button', { name: 'Continuar con Google' })

  useSessionStore.setState({ status: 'needsOnboarding' })

  await waitFor(() => {
    expect(window.location.pathname).toBe('/bienvenida')
  })
})
