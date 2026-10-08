import { CURRENCIES } from 'schemas/account'
import {
  currencySymbol,
  moneyTotal,
  unitPrice,
  unitPrices,
} from 'utils/formatMoney'

// specs/0012 CA-2
test('a total has the symbol first and the code last', () => {
  expect(moneyTotal('NIO', 9274.26)).toBe('C$9,274.26 NIO')
  expect(moneyTotal('USD', 1500)).toBe('$1,500.00 USD')
  expect(moneyTotal('HNL', 0.5)).toBe('L0.50 HNL')
  expect(moneyTotal('PAB', 12)).toBe('B/.12.00 PAB')
})

// specs/0026 RF-13: a loss reads "-C$300.00", never "C$-300.00"
test('a total below zero has the sign before the symbol', () => {
  expect(moneyTotal('NIO', -300)).toBe('-C$300.00 NIO')
  expect(moneyTotal('USD', -1250.5)).toBe('-$1,250.50 USD')
  expect(moneyTotal('USD', 0)).toBe('$0.00 USD')
})

test('a price per unit has only the symbol, and says litro in full', () => {
  expect(unitPrice('NIO', 185.49, 'gallon')).toBe('C$185.49/gal')
  expect(unitPrice('NIO', 49, 'liter')).toBe('C$49.00/litro')
  expect(unitPrices('CRC', 2500, 660.44)).toBe('₡2,500.00/gal · ₡660.44/litro')
})

test('every currency has its symbol', () => {
  for (const currency of CURRENCIES) {
    expect(currencySymbol(currency)).not.toBe('')
  }
})
