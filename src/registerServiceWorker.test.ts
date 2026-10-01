import { sileo } from 'sileo'
import { registerSW, type RegisterSWOptions } from 'virtual:pwa-register'
import registerServiceWorker from './registerServiceWorker'

vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn() }))

const updateSW = vi.fn<(reload?: boolean) => Promise<void>>()

const register = (): RegisterSWOptions => {
  vi.mocked(registerSW).mockReturnValue(updateSW)
  registerServiceWorker()
  const options = vi.mocked(registerSW).mock.calls[0]?.[0]
  if (!options) throw new Error('registerSW was not called')
  return options
}

// Regression: with duration null the toast showed collapsed and hid the button
test('offers the new version expanded, with its button visible', () => {
  register().onNeedRefresh?.()

  expect(sileo.action).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Nueva versión disponible',
      duration: 24 * 60 * 60 * 1000,
      autopilot: { expand: 0, collapse: 0 },
      button: expect.objectContaining({ title: 'Actualizar' }) as unknown,
    })
  )

  const [toast] = vi.mocked(sileo.action).mock.calls[0] ?? []
  toast?.button?.onClick()
  expect(updateSW).toHaveBeenCalledWith(true)
})

test('confirms when the app is ready to work offline', () => {
  register().onOfflineReady?.()

  expect(sileo.success).toHaveBeenCalledWith({
    title: 'Lista para usarse sin conexión',
  })
})
