// The store reads localStorage when it is created: import it fresh per test
const loadStore = async () => {
  vi.resetModules()
  const { useColorModeStore } = await import('store/colorMode')
  return useColorModeStore
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('keeps the choice stored by older versions', async () => {
  window.localStorage.setItem('isDarkModeActive', 'true')

  const store = await loadStore()

  expect(store.getState().mode).toBe('dark')
})

test('starts in light mode and remembers the switch', async () => {
  const store = await loadStore()
  expect(store.getState().mode).toBe('light')

  store.getState().toggle()

  expect(store.getState().mode).toBe('dark')
  expect(window.localStorage.getItem('isDarkModeActive')).toBe('true')
})

test('still switches for the session when it cannot be remembered', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const store = await loadStore()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceeded')
  })
  // resetModules also renews the mocked sileo the store imports
  const { sileo } = await import('sileo')

  store.getState().toggle()

  expect(store.getState().mode).toBe('dark')
  expect(sileo.error).toHaveBeenCalledWith({
    title: 'No pudimos recordar tu elección',
    description: 'Seguirá activa hasta que cierres la app.',
  })
})
