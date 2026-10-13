import { expense, trip } from '../testing/fleetFixtures'
import {
  amountIssues,
  amountMatcher,
  amountText,
  type AmountQuery,
} from 'utils/amountQuery'
import {
  driverOptions,
  expenseFiltersOn,
  filterExpenses,
  NO_EXPENSE_FILTERS,
  tripIdsOf,
  tripOptions,
  type ExpenseFilters,
} from 'utils/expenseFilters'

// backend specs/0043

const toll = expense()
const fuel = expense({
  id: 'expense-2',
  categoryId: 'org-a_fuel',
  categoryName: 'Combustible',
  amount: 6000,
  receiptPhotoPath: 'orgs/org-a/refuels/r1.jpg',
  refuelId: 'r1',
})
const tires = expense({
  id: 'expense-3',
  categoryId: 'org-a_tires',
  categoryName: 'Llantas',
  amount: 500,
  kind: 'truck',
  tripId: null,
  tripRoute: null,
  driverId: 'driver-2',
  driverName: 'Marta Gómez',
})
const otherTrip = expense({
  id: 'expense-4',
  amount: 2000,
  tripId: 'trip-2',
  tripRoute: 'León → Tegucigalpa',
  truckId: 'truck-2',
  truckName: 'Unidad 15',
})
const ALL = [toll, fuel, tires, otherTrip]

const TRIPS = new Map([
  ['trip-1', trip()],
  [
    'trip-2',
    trip({
      id: 'trip-2',
      origin: 'León',
      destination: 'Tegucigalpa',
      startAt: new Date(2026, 9, 9, 7, 0),
      driverId: 'driver-2',
      driverName: 'Marta Gómez',
      secondDriverId: 'driver-1',
      secondDriverName: 'Pedro Ruiz',
      driverIds: ['driver-2', 'driver-1'],
    }),
  ],
])
const tripOf = (id: string) => TRIPS.get(id)

const ids = (filters: Partial<ExpenseFilters>, tripsOf = tripOf) =>
  filterExpenses(ALL, { ...NO_EXPENSE_FILTERS, ...filters }, tripsOf).map(
    item => item.id
  )

const amount = (query: Partial<AmountQuery>): AmountQuery => ({
  op: 'any',
  from: '',
  to: '',
  ...query,
})

test('without filters every expense stays, and none is on', () => {
  expect(ids({})).toEqual(['expense-1', 'expense-2', 'expense-3', 'expense-4'])
  expect(expenseFiltersOn(NO_EXPENSE_FILTERS)).toBe(false)
})

test('categories: any of the ones chosen (RF-1)', () => {
  expect(ids({ categoryIds: ['org-a_tolls', 'org-a_fuel'] })).toEqual([
    'expense-1',
    'expense-2',
    'expense-4',
  ])
  expect(expenseFiltersOn({ ...NO_EXPENSE_FILTERS, categoryIds: ['x'] })).toBe(
    true
  )
})

test('truck and trip (RF-3, RF-4)', () => {
  expect(ids({ truckId: 'truck-2' })).toEqual(['expense-4'])
  expect(ids({ tripId: 'trip-1' })).toEqual(['expense-1', 'expense-2'])
})

test("a driver: the ones that name them, and their trips' (RF-5)", () => {
  // Marta drove trip-2 and had the tires
  expect(ids({ driverId: 'driver-2' })).toEqual(['expense-3', 'expense-4'])
  // Pedro drove trip-1, and was the second driver of trip-2
  expect(ids({ driverId: 'driver-1' })).toEqual([
    'expense-1',
    'expense-2',
    'expense-4',
  ])
  // Without the trips read, only the ones that name them
  expect(ids({ driverId: 'driver-2' }, () => undefined)).toEqual(['expense-3'])
})

test("with or without a receipt, a refuel's invoice counting (RF-6)", () => {
  expect(ids({ receipt: 'with' })).toEqual(['expense-2'])
  expect(ids({ receipt: 'without' })).toEqual([
    'expense-1',
    'expense-3',
    'expense-4',
  ])
})

describe('the amount (RF-7)', () => {
  test('greater, less, equal to the cent, and between both ends', () => {
    expect(ids({ amount: amount({ op: 'gt', from: '1,850' }) })).toEqual([
      'expense-2',
      'expense-4',
    ])
    expect(ids({ amount: amount({ op: 'lt', from: '1850' }) })).toEqual([
      'expense-3',
    ])
    expect(ids({ amount: amount({ op: 'eq', from: '1,850.00' }) })).toEqual([
      'expense-1',
    ])
    expect(ids({ amount: amount({ op: 'eq', from: '1,850.01' }) })).toEqual([])
    expect(
      ids({ amount: amount({ op: 'between', from: '500', to: '2,000' }) })
    ).toEqual(['expense-1', 'expense-3', 'expense-4'])
  })

  test('an empty or wrong amount filters nothing and says why', () => {
    expect(amountMatcher(amount({ op: 'gt' }))).toBeNull()
    expect(amountIssues(amount({ op: 'gt' }))).toEqual({})
    expect(amountMatcher(amount({ op: 'gt', from: 'mil' }))).toBeNull()
    expect(amountIssues(amount({ op: 'gt', from: 'mil' }))).toEqual({
      from: 'Escribe un monto, como 1,500.25',
    })
    const backwards = amount({ op: 'between', from: '2,000', to: '500' })
    expect(amountMatcher(backwards)).toBeNull()
    expect(amountIssues(backwards)).toEqual({
      to: 'Tiene que ser igual o mayor que "Desde"',
    })
    expect(ids({ amount: backwards })).toHaveLength(4)
  })

  test('its text, for the filter', () => {
    const money = (value: number) => `C$${value.toFixed(2)}`
    expect(amountText(amount({ op: 'gt', from: '1000' }), money)).toBe(
      'mayor a C$1000.00'
    )
    expect(
      amountText(amount({ op: 'between', from: '500', to: '2000' }), money)
    ).toBe('entre C$500.00 y C$2000.00')
    expect(amountText(amount({ op: 'eq' }), money)).toBeNull()
  })
})

test('every filter at once', () => {
  expect(
    ids({
      categoryIds: ['org-a_tolls'],
      driverId: 'driver-1',
      receipt: 'without',
      amount: amount({ op: 'gt', from: '1,900' }),
    })
  ).toEqual(['expense-4'])
})

describe('the options', () => {
  test('trips: each once, newest first; one not read by its route', () => {
    const label = (item: { origin: string; destination: string }) =>
      `${item.origin} → ${item.destination} (leído)`
    expect(tripIdsOf(ALL)).toEqual(['trip-1', 'trip-2'])
    expect(tripOptions(ALL, tripOf, label)).toEqual([
      { value: 'trip-2', label: 'León → Tegucigalpa (leído)' },
      { value: 'trip-1', label: 'Managua → San José (leído)' },
    ])
    expect(tripOptions(ALL, () => undefined, label)).toEqual([
      { value: 'trip-1', label: 'Managua → San José' },
      { value: 'trip-2', label: 'León → Tegucigalpa' },
    ])
  })

  test("drivers: the expenses' and their trips', by today's name", () => {
    const today = (id: string) => (id === 'driver-1' ? 'Pedro R.' : null)
    expect(driverOptions(ALL, tripOf, today)).toEqual([
      { value: 'driver-2', label: 'Marta Gómez' },
      { value: 'driver-1', label: 'Pedro R.' },
    ])
    expect(driverOptions(ALL, () => undefined, today)).toEqual([
      { value: 'driver-2', label: 'Marta Gómez' },
    ])
  })
})
