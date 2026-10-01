import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { sileo } from 'sileo'
import App from '../../App'
import { useSessionStore } from 'store/session'

const api = vi.hoisted(() => ({
  callAccount: vi.fn(() => Promise.resolve({ orgId: 'org-1' })),
  warmUpAccount: vi.fn(),
  readAccount: vi.fn(() =>
    Promise.resolve({
      profile: { displayName: 'Juan', activeOrgId: 'org-1' },
      memberships: [
        { orgId: 'org-1', role: 'owner', orgName: 'Flota de Juan' },
      ],
      organization: {
        id: 'org-1',
        name: 'Flota de Juan',
        defaultCurrency: 'NIO',
      },
    })
  ),
}))
vi.mock('services/session', () => api)

const signedInWith = (user: {
  displayName: string | null
  phoneNumber: string | null
}) => {
  useSessionStore.setState({
    status: 'needsOnboarding',
    user: { uid: 'u1', email: null, ...user },
    profile: null,
    start: () => Promise.resolve(),
  })
  window.history.pushState({}, '', '/bienvenida')
  render(<App />)
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('a phone user is asked their name; the organization name follows it (RF-7)', async () => {
  signedInWith({ displayName: null, phoneNumber: '+50588887777' })

  fireEvent.change(await screen.findByLabelText('¿Cómo te llamas?'), {
    target: { value: 'Juan Pérez' },
  })

  expect(screen.getByLabelText('Nombre de tu organización')).toHaveValue(
    'Flota de Juan'
  )
  // Currency from the phone's country
  expect(screen.getByLabelText('Moneda')).toHaveValue('NIO')
})

test('creates the organization with the values and goes home', async () => {
  signedInWith({ displayName: null, phoneNumber: '+50588887777' })
  fireEvent.change(await screen.findByLabelText('¿Cómo te llamas?'), {
    target: { value: 'Juan' },
  })

  fireEvent.click(screen.getByRole('button', { name: 'Empezar' }))

  await waitFor(() => {
    expect(api.callAccount).toHaveBeenCalledWith({
      action: 'bootstrap',
      displayName: 'Juan',
      orgName: 'Flota de Juan',
      currency: 'NIO',
    })
  })
  await waitFor(() => {
    expect(window.location.pathname).toBe('/')
  })
  expect(sileo.success).toHaveBeenCalledWith({
    title: 'Tu organización está lista',
    description: 'Flota de Juan',
  })
})

test('a Google user is not asked their name and starts with USD', async () => {
  signedInWith({ displayName: 'Ana Pérez', phoneNumber: null })

  expect(await screen.findByLabelText('Nombre de tu organización')).toHaveValue(
    'Flota de Ana'
  )
  expect(screen.queryByLabelText('¿Cómo te llamas?')).toBeNull()
  expect(screen.getByLabelText('Moneda')).toHaveValue('USD')
})

test('a phone user cannot skip the name', async () => {
  signedInWith({ displayName: null, phoneNumber: '+50588887777' })

  fireEvent.click(await screen.findByRole('button', { name: 'Empezar' }))

  expect(await screen.findByText('Escribe tu nombre')).toBeInTheDocument()
  expect(api.callAccount).not.toHaveBeenCalled()
})

test('a failed creation is explained and keeps the form', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  api.callAccount.mockRejectedValueOnce(
    Object.assign(new Error('x'), { code: 'functions/unavailable' })
  )
  signedInWith({ displayName: 'Ana', phoneNumber: null })

  fireEvent.click(await screen.findByRole('button', { name: 'Empezar' }))

  await waitFor(() => {
    expect(sileo.error).toHaveBeenCalledWith({
      title: 'No pudimos crear tu organización',
      description: 'Sin conexión. Revisa tu señal e inténtalo de nuevo.',
    })
  })
  expect(window.location.pathname).toBe('/bienvenida')
})

test('without a session it sends the user to sign in', async () => {
  useSessionStore.setState({
    status: 'signedOut',
    start: () => Promise.resolve(),
  })
  window.history.pushState({}, '', '/bienvenida')
  render(<App />)

  await waitFor(() => {
    expect(window.location.pathname).toBe('/entrar')
  })
})

test('someone left without organizations only names a new one (specs/0005)', async () => {
  useSessionStore.setState({
    status: 'needsOnboarding',
    user: {
      uid: 'u1',
      email: null,
      displayName: null,
      phoneNumber: '+50588887777',
    },
    profile: { displayName: 'Pedro Gómez', activeOrgId: null },
    start: () => Promise.resolve(),
  })
  window.history.pushState({}, '', '/bienvenida')
  render(<App />)
  expect(
    await screen.findByLabelText('Nombre de tu organización')
  ).toBeInTheDocument()
  expect(screen.queryByLabelText('¿Cómo te llamas?')).toBeNull()
  expect(screen.getByLabelText('Nombre de tu organización')).toHaveValue(
    'Flota de Pedro'
  )

  fireEvent.click(screen.getByRole('button', { name: 'Empezar' }))
  await waitFor(() => {
    expect(api.callAccount).toHaveBeenCalledWith({
      action: 'bootstrap',
      displayName: 'Pedro Gómez',
      orgName: 'Flota de Pedro',
      currency: 'NIO',
    })
  })
})
