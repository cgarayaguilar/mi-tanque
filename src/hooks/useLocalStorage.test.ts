import { act, renderHook } from '@testing-library/react'
import { sileo } from 'sileo'
import { useLocalStorage } from 'hooks/useLocalStorage'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('reads and persists the value', () => {
  window.localStorage.setItem('mode', JSON.stringify('dark'))
  const { result } = renderHook(() => useLocalStorage('mode', 'light'))

  expect(result.current[0]).toBe('dark')

  act(() => {
    result.current[1]('light')
  })

  expect(result.current[0]).toBe('light')
  expect(window.localStorage.getItem('mode')).toBe('"light"')
})

// Regression: a failed write was only logged and the choice was not applied
test('applies the value and tells the user when it cannot be saved', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError')
  })
  const { result } = renderHook(() => useLocalStorage('mode', 'light'))

  act(() => {
    result.current[1]('dark')
  })

  expect(result.current[0]).toBe('dark')
  expect(sileo.error).toHaveBeenCalledWith({
    title: 'No pudimos recordar tu elección',
    description: 'Seguirá activa hasta que cierres la app.',
  })
})

test('falls back to the default when the stored value is corrupt', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  window.localStorage.setItem('mode', '{not json')

  const { result } = renderHook(() => useLocalStorage('mode', 'light'))

  expect(result.current[0]).toBe('light')
  expect(sileo.error).not.toHaveBeenCalled()
})
