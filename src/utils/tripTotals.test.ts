import { tripTotals } from 'utils/tripTotals'
import { trip } from '../testing/fleetFixtures'

// backend specs/0025 RF-6, CA-6
test('the totals leave the cancelled out and add each currency apart', () => {
  expect(
    tripTotals([
      trip(),
      trip({ id: 't2', price: 18000, extras: [] }),
      trip({ id: 't3', status: 'cancelled' }),
      trip({ id: 't4', currency: 'USD', price: 1200, extras: [] }),
    ])
  ).toEqual({
    count: 3,
    income: ['C$45,500.00 NIO', '$1,200.00 USD'],
  })
  expect(tripTotals([])).toEqual({ count: 0, income: [] })
})
