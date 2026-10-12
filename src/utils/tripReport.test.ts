import type { Trip } from 'schemas/trips'
import { trip } from '../testing/fleetFixtures'
import { groupTrips, type TripNames } from 'utils/tripGroups'
import {
  pdfText,
  tripReport,
  tripReportFileName,
  type TripReportInput,
} from 'utils/tripReport'

// backend specs/0040
const sameNames: TripNames = {
  client: (_, saved) => saved,
  truck: (_, saved) => saved,
  trailer: (_, saved) => saved,
  driver: (_, saved) => saved,
}

const trips: Trip[] = [
  // 27,500 in, 4,000 out
  trip({ expensesTotal: 4000 }),
  trip({
    id: 'trip-2',
    origin: 'León',
    destination: 'Tegucigalpa',
    price: 18000,
    extras: [],
    status: 'in_progress',
    truckId: 'truck-2',
    truckName: 'Unidad 15',
    trailerId: null,
    trailerName: null,
    driverId: 'driver-2',
    driverName: 'Marta Gómez',
    secondDriverId: 'driver-1',
    secondDriverName: 'Pedro Ruiz',
    expensesTotal: 20000,
  }),
  trip({ id: 'trip-3', status: 'cancelled', price: 9999, extras: [] }),
]

const input = (overrides: Partial<TripReportInput> = {}): TripReportInput => ({
  organization: 'Flota de Cesar',
  period: '1 oct – 31 oct 2026',
  trips,
  groups: null,
  filters: [],
  grouping: null,
  order: 'Fecha, más reciente primero',
  names: sameNames,
  ownershipOf: () => ({ truck: 'own', trailer: 'own' }),
  currency: 'NIO',
  now: new Date(2026, 9, 12, 10, 30),
  ...overrides,
})

test('the heading says what is applied, and the summary leaves the cancelled out', () => {
  const report = tripReport(
    input({
      filters: ['Cliente: Transportes Pérez'],
      grouping: 'Camión',
      order: 'Precio, mayor primero',
    })
  )

  expect(report.subtitle).toBe('Flota de Cesar · 1 oct – 31 oct 2026')
  expect(report.applied).toBe(
    'Cliente: Transportes Pérez · Agrupado por Camión · Orden: Precio, mayor primero'
  )
  expect(report.summary).toEqual([
    '2 viajes, sin los cancelados',
    'Ingresos 45,500.00 NIO · Gastos 24,000.00 NIO · Utilidad 21,500.00 NIO',
  ])
  expect(report.generated).toBe('Generado el 12 oct 2026 a las 10:30')
  expect(report.head).toEqual([
    'Fecha',
    'Ruta',
    'Cliente',
    'Camión',
    'Conductor',
    'Estado',
    'Ingresos (NIO)',
    'Gastos (NIO)',
    'Utilidad (NIO)',
  ])
})

test('one row per trip, in the order given, with what the screen shows', () => {
  const [section] = tripReport(input()).sections

  expect(section?.title).toBeNull()
  expect(section?.rows.map(row => row.cells)).toEqual([
    [
      '6 oct 2026',
      'Managua – San José',
      'Transportes Pérez',
      'Unidad 12 · Caja 7',
      'Pedro Ruiz',
      'Programado',
      '27,500.00',
      '4,000.00',
      '23,500.00',
    ],
    [
      '6 oct 2026',
      'León – Tegucigalpa',
      'Transportes Pérez',
      'Unidad 15',
      'Marta Gómez y Pedro Ruiz',
      'En curso',
      '18,000.00',
      '20,000.00',
      '-2,000.00',
    ],
    expect.arrayContaining(['Cancelado', '9,999.00']),
  ])
  // A loss is red; a cancelled one is shown but does not count
  expect(section?.rows.map(row => [row.losing, row.cancelled])).toEqual([
    [false, false],
    [true, false],
    [false, true],
  ])
  expect(tripReport(input()).total.map(row => row.cells)).toEqual([
    [
      'Total',
      '2 viajes',
      '',
      '',
      '',
      '',
      '45,500.00 NIO',
      '24,000.00 NIO',
      '21,500.00 NIO',
    ],
  ])
})

test('grouped: each group with its title and its subtotal', () => {
  const groups = groupTrips(trips, 'truck', 'dateDesc', sameNames)
  const report = tripReport(input({ groups, grouping: 'Camión' }))

  expect(
    report.sections.map(section => [
      section.title,
      section.rows.length,
      section.subtotal.map(row => row.cells[1]),
    ])
  ).toEqual([
    ['Unidad 12', 2, ['1 viaje']],
    ['Unidad 15', 1, ['1 viaje']],
  ])
  expect(report.sections[1]?.subtotal[0]?.losing).toBe(true)
})

test('another currency says its code and adds up apart', () => {
  const report = tripReport(
    input({ trips: [trips[0] as Trip, trip({ id: 'usd', currency: 'USD' })] })
  )

  expect(report.sections[0]?.rows[1]?.cells.slice(6)).toEqual([
    '27,500.00 USD',
    '0.00 USD',
    '27,500.00 USD',
  ])
  expect(report.total.map(row => row.cells[6])).toEqual([
    '27,500.00 NIO',
    '27,500.00 USD',
  ])
})

test("only what the PDF's font can write", () => {
  expect(pdfText('Managua → León 🚚 ₡')).toBe('Managua – León')
  expect(pdfText('Camión Ñandú · “A” – 1€')).toBe('Camión Ñandú · “A” – 1€')
})

test('its file name says the organization and the period', () => {
  expect(
    tripReportFileName(
      { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) },
      'Flota de César'
    )
  ).toBe('solo-camioneros-viajes-flota-de-cesar-2026-10-01_2026-10-31.pdf')
})
