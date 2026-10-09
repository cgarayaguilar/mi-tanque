import type { Trip } from 'schemas/trips'
import {
  destinationOptions,
  filterTrips,
  groupSummary,
  groupTrips,
  NO_TRIP_FILTERS,
  routeKey,
  sortTrips,
  type TripNames,
} from 'utils/tripGroups'
import { tripPeriod } from 'utils/tripPeriod'
import { trip } from '../testing/fleetFixtures'

// The saved names, as when nothing was renamed
const names: TripNames = {
  client: (_, saved) => saved,
  truck: (_, saved) => saved,
  trailer: (_, saved) => saved,
  driver: (_, saved) => saved,
}

const at = (date: Date, overrides: Partial<Trip> = {}) =>
  trip({ startAt: date, ...tripPeriod(date), ...overrides })

const ids = (trips: readonly Trip[]) => trips.map(item => item.id)

// backend specs/0030 RF-1, CA-1
describe('filters', () => {
  const trips = [
    trip({ id: 'a' }),
    trip({ id: 'b', destination: 'san  jose', truckId: 'truck-2' }),
    trip({ id: 'c', destination: 'León' }),
    // The same route, of another client (specs/0033)
    trip({
      id: 'd',
      destination: 'León',
      clientId: 'client-2',
      clientName: 'Fletes Ríos',
      driverId: 'driver-2',
      secondDriverId: 'driver-1',
      driverIds: ['driver-2', 'driver-1'],
    }),
  ]

  test('a route however written, and filters that add up', () => {
    const sanJose = routeKey(trip())
    expect(
      ids(filterTrips(trips, { ...NO_TRIP_FILTERS, destination: sanJose }))
    ).toEqual(['a', 'b'])
    expect(
      ids(
        filterTrips(trips, {
          ...NO_TRIP_FILTERS,
          destination: sanJose,
          truckId: 'truck-2',
        })
      )
    ).toEqual(['b'])
  })

  test('a driver finds the trips where they are second too', () => {
    expect(
      ids(filterTrips(trips, { ...NO_TRIP_FILTERS, driverId: 'driver-1' }))
    ).toEqual(['a', 'b', 'c', 'd'])
    expect(
      ids(filterTrips(trips, { ...NO_TRIP_FILTERS, driverId: 'driver-2' }))
    ).toEqual(['d'])
  })

  // specs/0033 RF-1, CA-1: each client's routes, under its name
  test('each route once per client, as first written', () => {
    const leon = trip({ destination: 'León' })
    expect(destinationOptions(trips, names)).toEqual([
      {
        value: routeKey({ ...leon, clientId: 'client-2' }),
        label: 'Managua → León',
        group: 'Fletes Ríos',
      },
      {
        value: routeKey(leon),
        label: 'Managua → León',
        group: 'Transportes Pérez',
      },
      {
        value: routeKey(trip()),
        label: 'Managua → San José',
        group: 'Transportes Pérez',
      },
    ])
    // The route and its client: not the other client's trip
    expect(
      ids(
        filterTrips(trips, { ...NO_TRIP_FILTERS, destination: routeKey(leon) })
      )
    ).toEqual(['c'])
  })

  test("a route is written as its rate's, not as typed by hand", () => {
    const options = destinationOptions(
      [
        trip({
          id: 'typed',
          origin: 'managua',
          destination: 'san jose',
          rateId: null,
        }),
        trip({ id: 'rated' }),
      ],
      names
    )
    expect(options.map(option => option.label)).toEqual(['Managua → San José'])
  })

  test('another origin is another route', () => {
    expect(routeKey(trip({ origin: 'Rivas' }))).not.toBe(routeKey(trip()))
  })
})

// RF-7, CA-5
describe('order', () => {
  const trips = [
    at(new Date(2026, 9, 6), { id: 'cheap', price: 7000, extras: [] }),
    at(new Date(2026, 9, 8), { id: 'dear', price: 40000, extras: [] }),
    at(new Date(2026, 9, 1), { id: 'tie-old', price: 7000, extras: [] }),
  ]

  test('by date, both ways', () => {
    expect(ids(sortTrips(trips, 'dateDesc'))).toEqual([
      'dear',
      'cheap',
      'tie-old',
    ])
    expect(ids(sortTrips(trips, 'dateAsc'))).toEqual([
      'tie-old',
      'cheap',
      'dear',
    ])
  })

  test('by what the card shows, a tie newest first', () => {
    expect(ids(sortTrips(trips, 'priceDesc'))).toEqual([
      'dear',
      'cheap',
      'tie-old',
    ])
    expect(ids(sortTrips(trips, 'priceAsc'))).toEqual([
      'cheap',
      'tie-old',
      'dear',
    ])
    // The extras count: 25,000 + 2,500 is more than 26,000
    expect(
      ids(
        sortTrips(
          [trip({ id: 'x', price: 26000, extras: [] }), trip({ id: 'y' })],
          'priceDesc'
        )
      )
    ).toEqual(['y', 'x'])
  })
})

// RF-3 to RF-6
describe('groups', () => {
  test('by truck: A–Z, each sorted inside', () => {
    const groups = groupTrips(
      [
        trip({ id: 'a', price: 7000, extras: [] }),
        trip({ id: 'b', truckId: 'truck-2', truckName: 'Furgón 3' }),
        trip({ id: 'c', price: 40000, extras: [] }),
      ],
      'truck',
      'priceDesc',
      names
    )
    expect(
      groups.map(group => [group.title, ids(group.trips)] as const)
    ).toEqual([
      ['Furgón 3', ['b']],
      ['Unidad 12', ['c', 'a']],
    ])
  })

  test('the current name, not the saved one', () => {
    const [group] = groupTrips([trip()], 'client', 'dateDesc', {
      ...names,
      client: () => 'Transportes Pérez e Hijos',
    })
    expect(group?.title).toBe('Transportes Pérez e Hijos')
  })

  // CA-3
  test('by driver: a trip with two is in both groups', () => {
    const groups = groupTrips(
      [
        trip({ id: 'a' }),
        trip({
          id: 'b',
          secondDriverId: 'driver-2',
          secondDriverName: 'Marta Gómez',
          driverIds: ['driver-1', 'driver-2'],
        }),
      ],
      'driver',
      'dateDesc',
      names
    )
    expect(
      groups.map(group => [group.title, ids(group.trips)] as const)
    ).toEqual([
      ['Marta Gómez', ['b']],
      ['Pedro Ruiz', ['a', 'b']],
    ])
  })

  test('by trailer: without one, last', () => {
    const groups = groupTrips(
      [
        trip({ id: 'a', trailerId: null, trailerName: null }),
        trip({ id: 'b', trailerId: 'trailer-2', trailerName: 'Plataforma' }),
        trip({ id: 'c' }),
      ],
      'trailer',
      'dateDesc',
      names
    )
    expect(groups.map(group => group.title)).toEqual([
      'Caja 7',
      'Plataforma',
      'Sin remolque',
    ])
  })

  // specs/0033 RF-2, CA-2
  test('by destination: a route per client, by client then route', () => {
    const groups = groupTrips(
      [
        trip({ id: 'a' }),
        trip({ id: 'b', destination: 'san jose' }),
        trip({ id: 'c', origin: 'Rivas' }),
        trip({ id: 'd', clientId: 'client-2', clientName: 'Fletes Ríos' }),
      ],
      'destination',
      'dateDesc',
      names
    )
    expect(
      groups.map(group => [group.title, group.subtitle, ids(group.trips)])
    ).toEqual([
      ['Managua → San José', 'Fletes Ríos', ['d']],
      ['Managua → San José', 'Transportes Pérez', ['a', 'b']],
      ['Rivas → San José', 'Transportes Pérez', ['c']],
    ])
  })

  // CA-4
  test('by month and week, following the dates', () => {
    const trips = [
      at(new Date(2026, 8, 28), { id: 'sep' }),
      at(new Date(2026, 9, 6), { id: 'oct' }),
    ]
    expect(
      groupTrips(trips, 'month', 'dateDesc', names).map(group => group.title)
    ).toEqual(['octubre 2026', 'septiembre 2026'])
    expect(
      groupTrips(trips, 'month', 'dateAsc', names).map(group => group.title)
    ).toEqual(['septiembre 2026', 'octubre 2026'])
    // By price, the newest first
    expect(
      groupTrips(trips, 'week', 'priceAsc', names).map(group => group.title)
    ).toEqual(['del 5 oct al 11 oct', 'del 28 sep al 4 oct'])
  })

  test('by status, in its order', () => {
    const groups = groupTrips(
      [
        trip({ id: 'a', status: 'cancelled' }),
        trip({ id: 'b', status: 'done' }),
        trip({ id: 'c' }),
        trip({ id: 'd', status: 'in_progress' }),
      ],
      'status',
      'dateDesc',
      names
    )
    expect(groups.map(group => group.title)).toEqual([
      'Programado',
      'En curso',
      'Terminado',
      'Cancelado',
    ])
  })
})

// RF-4, CA-2
describe('summary', () => {
  test('count and income; the cancelled do not count', () => {
    expect(
      groupSummary([
        trip({ extras: [] }),
        trip({ id: 'b', extras: [] }),
        trip({ id: 'c', extras: [] }),
        trip({ id: 'd', status: 'cancelled' }),
      ])
    ).toBe('3 viajes · C$75,000.00 NIO')
    expect(groupSummary([trip()])).toBe('1 viaje · C$27,500.00 NIO')
  })

  test('each currency apart', () => {
    expect(
      groupSummary([
        trip({ extras: [] }),
        trip({ id: 'b', currency: 'USD', price: 1200, extras: [] }),
      ])
    ).toBe('2 viajes · C$25,000.00 NIO · $1,200.00 USD')
  })

  test('only cancelled ones', () => {
    expect(groupSummary([trip({ status: 'cancelled' })])).toBe(
      '1 cancelado, no cuenta'
    )
    expect(
      groupSummary([
        trip({ status: 'cancelled' }),
        trip({ id: 'b', status: 'cancelled' }),
      ])
    ).toBe('2 cancelados, no cuentan')
  })
})
