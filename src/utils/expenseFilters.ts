import type { Expense, ExpenseKind } from 'schemas/expenses'
import type { Trip } from 'schemas/trips'
import { ANY_AMOUNT, amountMatcher, type AmountQuery } from 'utils/amountQuery'

// What Gastos is filtered by (backend specs/0043), pure: the page only
// shows it, as utils/tripGroups for Viajes

export type ReceiptFilter = 'with' | 'without'

export const RECEIPT_LABELS: Record<ReceiptFilter, string> = {
  with: 'Con comprobante',
  without: 'Sin comprobante',
}

export interface ExpenseFilters {
  /** Any of these; none filters nothing (RF-1). */
  categoryIds: readonly string[]
  kind: ExpenseKind | null
  truckId: string | null
  tripId: string | null
  driverId: string | null
  receipt: ReceiptFilter | null
  amount: AmountQuery
}

export const NO_EXPENSE_FILTERS: ExpenseFilters = {
  categoryIds: [],
  kind: null,
  truckId: null,
  tripId: null,
  driverId: null,
  receipt: null,
  amount: ANY_AMOUNT,
}

/** A trip of the organization, if read: its drivers count (RF-5). */
export type TripOf = (id: string) => Trip | undefined

/** Whether the driver had the expense, or drove its trip (RF-5). */
const hasDriver = (expense: Expense, driverId: string, tripOf: TripOf) =>
  expense.driverId === driverId ||
  (expense.tripId !== null &&
    (tripOf(expense.tripId)?.driverIds.includes(driverId) ?? false))

/** The expenses that pass every filter on, in their order. */
export const filterExpenses = (
  expenses: readonly Expense[],
  filters: ExpenseFilters,
  tripOf: TripOf
): Expense[] => {
  const categories = new Set(filters.categoryIds)
  const amount = amountMatcher(filters.amount)
  return expenses.filter(
    expense =>
      (categories.size === 0 || categories.has(expense.categoryId)) &&
      (filters.kind === null || expense.kind === filters.kind) &&
      // A trip's expenses carry its truck: they count for it (0026 RF-9)
      (filters.truckId === null || expense.truckId === filters.truckId) &&
      (filters.tripId === null || expense.tripId === filters.tripId) &&
      (filters.driverId === null ||
        hasDriver(expense, filters.driverId, tripOf)) &&
      (filters.receipt === null ||
        (expense.receiptPhotoPath !== null) === (filters.receipt === 'with')) &&
      (amount === null || amount(expense.amount))
  )
}

/** Whether any filter narrows the list. */
export const expenseFiltersOn = (filters: ExpenseFilters) =>
  filters.categoryIds.length > 0 ||
  filters.kind !== null ||
  filters.truckId !== null ||
  filters.tripId !== null ||
  filters.driverId !== null ||
  filters.receipt !== null ||
  amountMatcher(filters.amount) !== null

/** The trips of the expenses, once each, to read the ones not known. */
export const tripIdsOf = (expenses: readonly Expense[]) => [
  ...new Set(
    expenses.flatMap(expense => (expense.tripId ? [expense.tripId] : []))
  ),
]

export interface ExpenseOption {
  value: string
  label: string
}

const byLabel = (a: ExpenseOption, b: ExpenseOption) =>
  a.label.localeCompare(b.label, 'es')

/**
 * The trips of the period's expenses (RF-4), newest first: with its date,
 * route and client when read, else its route.
 */
export const tripOptions = (
  expenses: readonly Expense[],
  tripOf: TripOf,
  label: (trip: Trip) => string
): ExpenseOption[] => {
  const options = new Map<string, { label: string; startAt: number }>()
  for (const expense of expenses) {
    if (!expense.tripId || options.has(expense.tripId)) continue
    const trip = tripOf(expense.tripId)
    options.set(expense.tripId, {
      label: trip ? label(trip) : (expense.tripRoute ?? 'Viaje'),
      startAt: trip?.startAt.getTime() ?? 0,
    })
  }
  return [...options]
    .sort(([, a], [, b]) => b.startAt - a.startAt)
    .map(([value, { label: text }]) => ({ value, label: text }))
}

/**
 * The drivers of the period's expenses and of their trips (RF-5), by name:
 * the fleet's today, else the copy saved.
 */
export const driverOptions = (
  expenses: readonly Expense[],
  tripOf: TripOf,
  currentName: (id: string) => string | null
): ExpenseOption[] => {
  const names = new Map<string, string>()
  const add = (id: string | null, saved: string | null) => {
    if (!id || names.has(id)) return
    names.set(id, currentName(id) ?? saved ?? 'Conductor')
  }
  for (const expense of expenses) {
    add(expense.driverId, expense.driverName)
    const trip = expense.tripId ? tripOf(expense.tripId) : undefined
    if (trip) {
      add(trip.driverId, trip.driverName)
      add(trip.secondDriverId, trip.secondDriverName)
    }
  }
  return [...names].map(([value, label]) => ({ value, label })).sort(byLabel)
}
