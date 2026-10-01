import { useEffect, useRef, useState } from 'react'

interface Result<T> {
  key: string
  value?: T
  error?: unknown
}

/**
 * Loads data for `key` (null: nothing to load). While a reload runs, the
 * last value of the same key stays on screen; another key starts empty.
 */
export const useLoad = <T>(key: string | null, load: () => Promise<T>) => {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<T> | null>(null)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })
  const requestKey = key === null ? null : `${key}#${String(attempt)}`

  useEffect(() => {
    if (requestKey === null) return
    let active = true
    loadRef.current().then(
      value => {
        if (active) setResult({ key: requestKey, value })
      },
      (error: unknown) => {
        if (active) setResult({ key: requestKey, error })
      }
    )
    return () => {
      active = false
    }
  }, [requestKey])

  const sameKey =
    result !== null && key !== null && result.key.startsWith(`${key}#`)
  const current = result?.key === requestKey ? result : null
  return {
    value: sameKey ? result.value : undefined,
    error: current?.error,
    loading: current === null,
    reload: () => {
      setAttempt(value => value + 1)
    },
  }
}
