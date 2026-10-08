import { tripTotals } from 'utils/tripTotals'
import { trip } from '../testing/fleetFixtures'

// backend specs/0025 RF-6, CA-6; specs/0026 RF-14, CA-7
test('the totals leave the cancelled out and add each currency apart', () => {
  expect(
    tripTotals([
      trip({ expensesTotal: 3200 }),
      trip({ id: 't2', price: 18000, extras: [], expensesTotal: 800.5 }),
      trip({ id: 't3', status: 'cancelled', expensesTotal: 999 }),
      trip({
        id: 't4',
        currency: 'USD',
        price: 1200,
        extras: [],
        expensesTotal: 1500,
      }),
    ])
  ).toEqual({
    count: 3,
    income: ['C$45,500.00 NIO', '$1,200.00 USD'],
    expenses: ['C$4,000.50 NIO', '$1,500.00 USD'],
    profit: ['C$41,499.50 NIO', '-$300.00 USD'],
    losing: [false, true],
  })
  expect(tripTotals([])).toEqual({
    count: 0,
    income: [],
    expenses: [],
    profit: [],
    losing: [],
  })
})
