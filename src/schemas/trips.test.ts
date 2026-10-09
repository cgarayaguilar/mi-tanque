import {
  EMPTY_TRIP_FORM,
  tripFormSchema,
  tripFromForm,
  tripIncome,
  tripStartIssue,
  tripToForm,
  type TripContext,
  type TripFormValues,
} from 'schemas/trips'
import {
  client,
  driver,
  rate,
  trailer,
  trip,
  truck,
} from '../testing/fleetFixtures'

const context: TripContext = {
  currency: 'NIO',
  clients: [client()],
  trucks: [truck()],
  trailers: [trailer()],
  drivers: [driver(), driver({ id: 'driver-2', name: 'Marta Gómez' })],
  rates: [rate()],
}

const fromRate: TripFormValues = {
  ...EMPTY_TRIP_FORM(new Date(2026, 9, 6, 8, 0)),
  clientId: 'client-1',
  rateId: 'rate-1',
  extras: [{ description: 'Parada en León', amount: '2,500' }],
  truckId: 'truck-1',
  trailerId: 'trailer-1',
  driverId: 'driver-1',
}

const manual: TripFormValues = {
  ...fromRate,
  mode: 'manual',
  rateId: '',
  origin: 'León',
  destination: 'Tegucigalpa',
  price: '18,000',
  extras: [],
  trailerId: '',
  secondDriverId: 'driver-2',
}

const messages = (values: TripFormValues) => {
  const result = tripFormSchema.safeParse(values)
  return result.success
    ? []
    : result.error.issues.map(issue => [issue.path.join('.'), issue.message])
}

// backend specs/0025 RF-9, CA-2, CA-4
describe('the form', () => {
  test('a trip from a rate and a manual one are valid', () => {
    expect(messages(fromRate)).toEqual([])
    expect(messages(manual)).toEqual([])
  })

  test.each([
    [{ clientId: '' }, 'clientId', 'Elige el cliente'],
    [{ rateId: '' }, 'rateId', 'Elige la tarifa'],
    [{ truckId: '' }, 'truckId', 'Elige el camión'],
    [{ driverId: '' }, 'driverId', 'Elige el conductor'],
    [{ startAt: '' }, 'startAt', 'Escribe la fecha y hora de inicio'],
    [
      { status: 'done' as const },
      'endAt',
      'Para terminarlo, pon la fecha y hora de fin',
    ],
    [
      { endAt: '2026-10-05T08:00' },
      'endAt',
      'El fin no puede ser antes del inicio',
    ],
    [{ endAt: 'invalid' }, 'endAt', 'Escribe una fecha y hora válidas'],
    [
      { extras: [{ description: '', amount: '0' }] },
      'extras.0.description',
      'Escribe qué es',
    ],
    [
      { extras: [{ description: 'Parada', amount: '0' }] },
      'extras.0.amount',
      'Ingresa un monto mayor que 0',
    ],
  ])('%o says %s: %s', (values, field, message) => {
    expect(messages({ ...fromRate, ...values })).toContainEqual([
      field,
      message,
    ])
  })

  test('a manual trip needs its route and price; one driver twice is not two', () => {
    expect(
      messages({ ...manual, origin: '', destination: '', price: '' })
    ).toEqual(
      expect.arrayContaining([
        ['origin', 'Escribe el origen'],
        ['destination', 'Escribe el destino'],
        ['price', 'Escribe el precio'],
      ])
    )
    expect(messages({ ...manual, secondDriverId: 'driver-1' })).toContainEqual([
      'secondDriverId',
      'Elige otro conductor',
    ])
  })
})

// RF-1, CA-1, CA-2
describe('the fields written', () => {
  test('from a rate: its route and price copied, the names, the period', () => {
    expect(tripFromForm(fromRate, context)).toEqual({
      status: 'scheduled',
      startAt: new Date(2026, 9, 6, 8, 0),
      endAt: null,
      year: 2026,
      month: 10,
      yearMonth: '2026-10',
      monthLabel: 'octubre 2026',
      weekStart: '2026-10-05',
      weekLabel: 'del 5 oct al 11 oct',
      mode: 'rate',
      rateId: 'rate-1',
      origin: 'Managua',
      destination: 'San José',
      price: 25000,
      extras: [{ description: 'Parada en León', amount: 2500 }],
      currency: 'NIO',
      clientId: 'client-1',
      clientName: 'Transportes Pérez',
      truckId: 'truck-1',
      truckName: 'Unidad 12',
      trailerId: 'trailer-1',
      trailerName: 'Caja 7',
      truckOwnership: 'own',
      trailerOwnership: 'own',
      driverId: 'driver-1',
      driverName: 'Pedro Ruiz',
      secondDriverId: null,
      secondDriverName: null,
      driverIds: ['driver-1'],
      tripNumber: null,
      description: null,
      notes: null,
    })
  })

  test('manual, with two drivers and no trailer', () => {
    expect(tripFromForm(manual, context)).toMatchObject({
      mode: 'manual',
      rateId: null,
      origin: 'León',
      destination: 'Tegucigalpa',
      price: 18000,
      trailerId: null,
      trailerName: null,
      secondDriverId: 'driver-2',
      secondDriverName: 'Marta Gómez',
      driverIds: ['driver-1', 'driver-2'],
    })
  })

  // backend specs/0035 RF-2: whose its truck and trailer were, copied
  test("a third party's truck is saved as such; no trailer, no owner", () => {
    expect(
      tripFromForm(fromRate, {
        ...context,
        trucks: [truck({ ownership: 'third_party', ownerName: 'López' })],
      })
    ).toMatchObject({ truckOwnership: 'third_party', trailerOwnership: 'own' })
    expect(tripFromForm({ ...fromRate, trailerId: '' }, context)).toMatchObject(
      { trailerId: null, trailerOwnership: null }
    )
  })

  // Owner, 2026-10-07: changing a rate does not touch the trips saved
  test('an edited trip that keeps its rate keeps its copy and currency', () => {
    const saved = trip({ price: 24000, currency: 'USD' })
    const changed = { ...context, rates: [rate({ price: 30000 })] }
    expect(tripFromForm(tripToForm(saved), changed, saved)).toMatchObject({
      rateId: 'rate-1',
      price: 24000,
      currency: 'USD',
    })
    // Another rate takes that rate's values
    const other = rate({ id: 'rate-2', destination: 'León', price: 9000 })
    expect(
      tripFromForm(
        { ...tripToForm(saved), rateId: 'rate-2' },
        { ...changed, rates: [...changed.rates, other] },
        saved
      )
    ).toMatchObject({ rateId: 'rate-2', destination: 'León', price: 9000 })
  })

  test('the income is the price plus the extras', () => {
    expect(tripIncome(trip())).toBe(27500)
    expect(tripIncome(trip({ extras: [] }))).toBe(25000)
  })
})

// Audit 0027: the rules take a start from 2020 to a year ahead
test("a trip's start within the rules' bounds", () => {
  const now = new Date(2026, 9, 8, 12)
  expect(tripStartIssue(new Date(2019, 11, 31), now)).toBe(
    'Escribe una fecha desde 2020'
  )
  expect(tripStartIssue(new Date(2027, 9, 9), now)).toBe(
    'El inicio no puede ser dentro de más de un año'
  )
  expect(tripStartIssue(new Date(2027, 9, 1), now)).toBeNull()
  expect(
    tripFormSchema.safeParse({ ...fromRate, startAt: '0026-10-08T10:00' })
      .success
  ).toBe(false)
})

// Audit 0027: doubled spaces are not saved
test('places are saved without doubled spaces', () => {
  expect(
    tripFromForm(
      {
        ...fromRate,
        mode: 'manual',
        rateId: '',
        origin: '  León   Viejo ',
        destination: 'Managua',
        price: '9000',
      },
      context
    )
  ).toMatchObject({ origin: 'León Viejo' })
})
