import { useEffect, useMemo, useState } from 'react'
import type { Expense } from 'schemas/expenses'
import { readTripExpenses } from 'services/expenses'
import { useExpensesStore } from 'store/expenses'
import { reportError } from 'utils/reportError'

// Imports the expenses service statically: only lazy pages use this hook

export type TripExpensesStatus = 'loading' | 'ready' | 'error'

/**
 * A trip's expenses (specs/0026 RF-12, RF-13): read once, then from the
 * store, so one saved or removed here shows at once.
 */
export const useTripExpenses = (
  orgId: string,
  tripId: string | null
): [TripExpensesStatus, Expense[], () => void] => {
  const known = useExpensesStore(state => state.known)
  const replaceTripExpenses = useExpensesStore(
    state => state.replaceTripExpenses
  )
  const [attempt, setAttempt] = useState(0)
  const [read, setRead] = useState<{
    tripId: string
    status: TripExpensesStatus
  } | null>(null)

  useEffect(() => {
    if (!tripId || !orgId) return
    let current = true
    readTripExpenses(orgId, tripId)
      .then(expenses => {
        if (!current) return
        replaceTripExpenses(tripId, expenses)
        setRead({ tripId, status: 'ready' })
      })
      .catch((error: unknown) => {
        reportError(error, { operation: 'readTripExpenses' })
        if (current) setRead({ tripId, status: 'error' })
      })
    return () => {
      current = false
    }
  }, [orgId, tripId, replaceTripExpenses, attempt])

  const expenses = useMemo(
    () =>
      Object.values(known)
        .filter(expense => expense.tripId !== null && expense.tripId === tripId)
        .sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime()),
    [known, tripId]
  )
  const status: TripExpensesStatus =
    !tripId || read?.tripId !== tripId ? 'loading' : read.status

  return [
    tripId ? status : 'ready',
    expenses,
    () => {
      setRead(null)
      setAttempt(value => value + 1)
    },
  ]
}
