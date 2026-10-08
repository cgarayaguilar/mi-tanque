import { CURRENCY_DETAILS, type Currency } from 'schemas/account'
import { formatNumber } from 'utils/formatNumber'

// The only place that writes money (backend specs/0012 RF-2): the symbol
// first, as on an invoice, and the code where a total could be mistaken
// ($ is both the dollar and the Mexican peso; L is the lempira and liters).

export const currencySymbol = (currency: Currency) =>
  CURRENCY_DETAILS[currency].symbol

/** A total: "C$9,274.26 NIO"; below zero, "-C$300.00 NIO" (a loss). */
export const moneyTotal = (currency: Currency, amount: number) =>
  `${amount < 0 ? '-' : ''}${currencySymbol(currency)}${formatNumber(Math.abs(amount), 2)} ${currency}`

/** A price per unit, without the code: "C$185.49/gal", "C$49.00/litro". */
export const unitPrice = (
  currency: Currency,
  amount: number,
  unit: 'gallon' | 'liter'
) =>
  `${currencySymbol(currency)}${formatNumber(amount, 2)}/${unit === 'gallon' ? 'gal' : 'litro'}`

/** Both prices of a refuel: "C$185.49/gal · C$49.00/litro". */
export const unitPrices = (
  currency: Currency,
  perGallon: number,
  perLiter: number
) =>
  `${unitPrice(currency, perGallon, 'gallon')} · ${unitPrice(currency, perLiter, 'liter')}`
