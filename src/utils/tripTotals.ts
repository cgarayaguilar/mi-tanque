import type { Currency } from 'schemas/account'
import { toCents, tripIncome, type Trip } from 'schemas/trips'
import { moneyTotal } from 'utils/formatMoney'

/**
 * "12 viajes · C$310,500.00 NIO": the cancelled ones do not count, and each
 * currency adds up apart (specs/0025 RF-6). Expenses and profit come from
 * each trip's `expensesTotal` (specs/0026 RF-14).
 */
export const tripTotals = (trips: readonly Trip[]) => {
  const counted = trips.filter(trip => trip.status !== 'cancelled')
  const byCurrency = new Map<Currency, { income: number; expenses: number }>()
  for (const trip of counted) {
    const total = byCurrency.get(trip.currency) ?? { income: 0, expenses: 0 }
    total.income += tripIncome(trip)
    total.expenses += trip.expensesTotal
    byCurrency.set(trip.currency, total)
  }
  const totals = [...byCurrency]
  const each = (
    amount: (total: { income: number; expenses: number }) => number
  ) =>
    totals.map(([currency, total]) =>
      moneyTotal(currency, toCents(amount(total)))
    )
  return {
    count: counted.length,
    income: each(total => total.income),
    expenses: each(total => total.expenses),
    profit: each(total => total.income - total.expenses),
    /** Per currency, whether the profit is below zero: shown in red. */
    losing: totals.map(
      ([, total]) => toCents(total.income - total.expenses) < 0
    ),
  }
}
