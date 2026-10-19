import type { Trip } from 'schemas/trips'
import { trip } from '../testing/fleetFixtures'
import { groupTrips, type TripNames } from 'utils/tripGroups'
import {
  pdfText,
  tripReport,
  tripReportFileName,
  type TripReportInput,
} from 'utils/tripReport'

// backend specs/0040, 0041
const sameNames: TripNames = {
  client: (_, saved) => saved,
  truck: (_, saved) => saved,
  trailer: (_, saved) => saved,
  driver: (_, saved) => saved,
}

const trips: Trip[] = [
  // 25,000 + 2,500 in, 4,000 out
  trip({ expensesTotal: 4000, tripNumber: 'V-101' }),
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
  kind: 'internal',
  organization: 'Flota de Cesar',
  period: '1 oct – 31 oct 2026',
  trips,
  groups: null,
  filters: [],
  client: null,
  grouping: null,
  order: 'Fecha, más reciente primero',
  names: sameNames,
  // Unidad 12 has a plate; Unidad 15 has none and goes by its name
  plates: {
    truck: (id, saved) => (id === 'truck-1' ? 'M 123-456' : saved),
    trailer: (id, saved) => (id === 'trailer-1' ? 'R 98-765' : saved),
  },
  ownershipOf: () => ({ truck: 'own', trailer: 'own' }),
  currency: 'NIO',
  now: new Date(2026, 9, 12, 10, 30),
  ...overrides,
})

describe('the internal report', () => {
  test('its heading says what is applied, with symbols in the summary', () => {
    const report = tripReport(
      input({
        filters: ['Cliente: Transportes Pérez'],
        grouping: 'Camión',
        order: 'Precio, mayor primero',
      })
    )

    expect(report.title).toBe('Viajes')
    expect(report.subtitle).toBe('Flota de Cesar · 1 oct – 31 oct 2026')
    expect(report.applied).toBe(
      'Cliente: Transportes Pérez · Agrupado por Camión · Orden: Precio, mayor primero'
    )
    expect(report.summary).toEqual([
      '2 viajes, sin los cancelados',
      'Ingresos C$45,500.00 NIO · Gastos C$24,000.00 NIO · Utilidad C$21,500.00 NIO',
    ])
    expect(report.generated).toBe('Generado el 12 oct 2026 a las 10:30')
    expect(report.head).toEqual([
      'Fecha',
      'Ruta',
      'Cliente',
      'Camión',
      'Remolque',
      'Conductor',
      'Estado',
      'Ingresos (NIO)',
      'Gastos (NIO)',
      'Utilidad (NIO)',
    ])
    expect([report.moneyFrom, report.profitColumn]).toEqual([7, 9])
  })

  test('one row per trip: plates, the route with its arrow, money with its symbol', () => {
    const [section] = tripReport(input()).sections

    expect(section?.rows.map(row => row.cells)).toEqual([
      [
        '6 oct 2026',
        'Managua → San José',
        'Transportes Pérez',
        'M 123-456',
        'R 98-765',
        'Pedro Ruiz',
        'Programado',
        'C$27,500.00',
        'C$4,000.00',
        'C$23,500.00',
      ],
      [
        '6 oct 2026',
        'León → Tegucigalpa',
        'Transportes Pérez',
        'Unidad 15',
        '',
        'Marta Gómez y Pedro Ruiz',
        'En curso',
        'C$18,000.00',
        'C$20,000.00',
        '-C$2,000.00',
      ],
      expect.arrayContaining(['Cancelado', 'C$9,999.00']),
    ])
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
        '',
        'C$45,500.00 NIO',
        'C$24,000.00 NIO',
        'C$21,500.00 NIO',
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

  test('another currency keeps its symbol and adds up apart', () => {
    const report = tripReport(
      input({
        trips: [trips[0] as Trip, trip({ id: 'crc', currency: 'CRC' })],
      })
    )

    expect(report.sections[0]?.rows[1]?.cells.slice(7)).toEqual([
      '₡27,500.00',
      '₡0.00',
      '₡27,500.00',
    ])
    expect(report.total.map(row => row.cells[7])).toEqual([
      'C$27,500.00 NIO',
      '₡27,500.00 CRC',
    ])
  })
})

// 0041 RF-3, RF-4
describe('the support for the client', () => {
  const groups = groupTrips(trips, 'truck', 'dateDesc', sameNames)
  const report = tripReport(
    input({
      kind: 'client',
      groups,
      grouping: 'Camión',
      filters: ['Cliente: Transportes Pérez', 'Dueño del camión: Propio'],
      client: 'Transportes Pérez',
    })
  )

  test('its heading: the support and the client, nothing internal', () => {
    expect(report.title).toBe('Soporte de viajes')
    expect(report.applied).toBe('Cliente: Transportes Pérez')
    expect(report.summary).toEqual([
      '2 viajes',
      'Total de ingresos C$45,500.00 NIO',
    ])
    expect(report.profitColumn).toBeNull()
  })

  test('one table, without the cancelled, with the income only', () => {
    expect(report.head).toEqual([
      'N.º',
      'Fecha',
      'Ruta',
      'Camión',
      'Remolque',
      'Conductor',
      'Precio (NIO)',
      'Otros ingresos (NIO)',
      'Total (NIO)',
    ])
    expect(report.sections).toHaveLength(1)
    expect(report.sections[0]?.title).toBeNull()
    expect(report.sections[0]?.rows.map(row => row.cells)).toEqual([
      [
        'V-101',
        '6 oct 2026',
        'Managua → San José',
        'M 123-456',
        'R 98-765',
        'Pedro Ruiz',
        'C$25,000.00',
        'C$2,500.00',
        'C$27,500.00',
      ],
      [
        '',
        '6 oct 2026',
        'León → Tegucigalpa',
        'Unidad 15',
        '',
        'Marta Gómez y Pedro Ruiz',
        'C$18,000.00',
        '',
        'C$18,000.00',
      ],
    ])
    expect(report.total.map(row => row.cells)).toEqual([
      [
        'Total',
        '2 viajes',
        '',
        '',
        '',
        '',
        'C$43,000.00 NIO',
        'C$2,500.00 NIO',
        'C$45,500.00 NIO',
      ],
    ])
  })

  // Regression (owner, 2026-10-18): "(de un tercero)" is internal, and
  // showed in the client's support
  // After N.º, Fecha and Ruta: Camión and Remolque
  test("a third party's truck and trailer go by their plates only", () => {
    const theirs = input({
      ownershipOf: () => ({ truck: 'third_party', trailer: 'third_party' }),
    })
    const [support] = tripReport({ ...theirs, kind: 'client' }).sections
    expect(support?.rows[0]?.cells.slice(3, 5)).toEqual([
      'M 123-456',
      'R 98-765',
    ])
    expect(
      JSON.stringify(tripReport({ ...theirs, kind: 'client' }))
    ).not.toMatch(/tercero/)
    // The internal report still says it
    const [internal] = tripReport(theirs).sections
    expect(internal?.rows[0]?.cells[3]).toMatch(/de un tercero/)
  })

  test('without a trip number, no N.º column', () => {
    const plain = tripReport(input({ kind: 'client', trips: trips.slice(1) }))
    expect(plain.head[0]).toBe('Fecha')
    expect(plain.applied).toBeNull()
  })
})

test("only what the PDF's font can write", () => {
  expect(pdfText('Managua → León 🚚 ₡')).toBe('Managua → León ₡')
  expect(pdfText('Camión Ñandú · “A” – 1€')).toBe('Camión Ñandú · “A” – 1€')
})

test('its file name says which one, the organization and the period', () => {
  const period = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) }
  expect(tripReportFileName('internal', period, 'Flota de César')).toBe(
    'solo-camioneros-viajes-flota-de-cesar-2026-10-01_2026-10-31.pdf'
  )
  expect(tripReportFileName('client', period, 'Flota de César')).toBe(
    'solo-camioneros-soporte-viajes-flota-de-cesar-2026-10-01_2026-10-31.pdf'
  )
})
