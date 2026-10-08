import type { Currency } from 'schemas/account'
import { tripIncome, type Trip } from 'schemas/trips'
import { moneyTotal } from 'utils/formatMoney'

/**
 * "12 viajes · C$310,500.00 NIO": the cancelled ones do not count, and each
 * currency adds up apart (specs/0025 RF-6).
 */
export const tripTotals = (trips: readonly Trip[]) => {
  const counted = trips.filter(trip => trip.status !== 'cancelled')
  const byCurrency = new Map<Currency, number>()
  for (const trip of counted) {
    byCurrency.set(
      trip.currency,
      (byCurrency.get(trip.currency) ?? 0) + tripIncome(trip)
    )
  }
  return {
    count: counted.length,
    income: [...byCurrency].map(([currency, amount]) =>
      moneyTotal(currency, Math.round(amount * 100) / 100)
    ),
  }
}
