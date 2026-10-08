import { useEffect, useState } from 'react'
import type { Expense } from 'schemas/expenses'
import { readExpense } from 'services/expenses'
import { useExpensesStore } from 'store/expenses'
import { reportError } from 'utils/reportError'

// Imports the expenses service statically: only lazy pages use this hook

export type LoadedExpense =
  | { status: 'loading' | 'missing' | 'error' }
  | { status: 'ready'; expense: Expense }

/** An expense: from what the store knows, or read on its own. */
export const useExpense = (id: string | null): [LoadedExpense, () => void] => {
  const known = useExpensesStore(state => (id ? state.known[id] : undefined))
  const remember = useExpensesStore(state => state.remember)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<LoadedExpense>({ status: 'loading' })

  useEffect(() => {
    if (!id || known) return
    let current = true
    readExpense(id)
      .then(expense => {
        if (!current) return
        if (expense) remember([expense])
        else setLoaded({ status: 'missing' })
      })
      .catch((error: unknown) => {
        reportError(error, { operation: 'readExpense' })
        if (current) setLoaded({ status: 'error' })
      })
    return () => {
      current = false
    }
  }, [id, known, remember, attempt])

  return [
    known ? { status: 'ready', expense: known } : loaded,
    () => {
      setLoaded({ status: 'loading' })
      setAttempt(value => value + 1)
    },
  ]
}
