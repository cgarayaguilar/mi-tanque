import { useState } from 'react'
import { sileo } from 'sileo'
import { reportError } from 'utils/reportError'

/** State persisted in localStorage under `key`. Values must be JSON-serializable. */
export const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      // Only this hook writes these keys, always with JSON.stringify(value: T)
      return item !== null ? (JSON.parse(item) as T) : initialValue
    } catch (error) {
      // No toast: the default is a valid state and there is nothing to act on
      reportError(error, { operation: 'readLocalStorage', key })
      return initialValue
    }
  })

  const setValue = (value: T) => {
    // Apply it for this session even if it cannot be persisted
    setStoredValue(value)

    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      reportError(error, { operation: 'writeLocalStorage', key })
      sileo.error({
        title: 'No pudimos recordar tu elección',
        description: 'Seguirá activa hasta que cierres la app.',
      })
    }
  }

  return [storedValue, setValue]
}
