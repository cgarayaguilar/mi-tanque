import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Currency } from 'schemas/account'
import { routeName } from 'schemas/rates'
import {
  TRIP_STATUS_LABELS,
  toCents,
  tripIncome,
  type Trip,
} from 'schemas/trips'
import type { Period } from 'types'
import { slug } from 'utils/csv'
import { moneyAmount, moneyTotal } from 'utils/formatMoney'
import { thirdParty } from 'utils/ownership'
import type { TripGroup, TripNames, TripOwnershipOf } from 'utils/tripGroups'

// What the trips' PDFs say (backend specs/0040, 0041), pure: the page gives
// what it shows, and services/tripPdf only draws it

/**
 * The internal report, with expenses and profit (0040), or the support for
 * the client, with only the trips and their income (0041 RF-3, RF-4).
 */
export type TripReportKind = 'internal' | 'client'

export interface ReportRow {
  cells: string[]
  /** Shown, but not counted (0040 RF-4). */
  cancelled: boolean
  /** Its profit is below zero: red (0040 RF-7). */
  losing: boolean
}

export interface ReportSection {
  /** A group's title and subtitle; null without grouping (0040 RF-5). */
  title: string | null
  subtitle: string | null
  rows: ReportRow[]
  /** Its subtotal, one row per currency; none without grouping. */
  subtotal: ReportRow[]
}

export interface TripReport {
  kind: TripReportKind
  title: string
  /** "Flota de Cesar · 1 oct – 31 oct 2026" */
  subtitle: string
  /** What is applied, or the client: "Cliente: Walmart". */
  applied: string | null
  /** The summary: one line per currency. */
  summary: string[]
  generated: string
  head: string[]
  /** The first column of money: from it on, right-aligned. */
  moneyFrom: number
  /** The profit's column, red when below zero; null without one. */
  profitColumn: number | null
  sections: ReportSection[]
  total: ReportRow[]
}

/** A truck's or trailer's plate as it is today, or its name (0041 RF-2). */
export interface TripPlates {
  truck: (id: string, saved: string) => string
  trailer: (id: string, saved: string) => string
}

export interface TripReportInput {
  kind: TripReportKind
  organization: string
  period: string
  /** The trips shown, filtered and in their order. */
  trips: readonly Trip[]
  /** The groups shown, or null without grouping. */
  groups: readonly TripGroup[] | null
  /** "Cliente: Walmart", one per filter on. */
  filters: readonly string[]
  /** The client the list is filtered by, if one: the support says it. */
  client: string | null
  /** "Camión", or null without grouping. */
  grouping: string | null
  /** "Fecha, más reciente primero" */
  order: string
  names: TripNames
  plates: TripPlates
  ownershipOf: TripOwnershipOf
  /** The organization's: the money columns' headers say it. */
  currency: Currency
  now: Date
}

// What the PDF's font has: Inter cut to Latin letters, signs, currency
// symbols and arrows (src/assets/fonts/README.md), as code point ranges.
// Anything else, as an emoji, would print as a box: it is dropped (0041 RF-8)
const PDF_FONT_RANGES: readonly (readonly [number, number])[] = [
  [0x20, 0x7e],
  [0xa0, 0xff],
  [0x152, 0x153],
  [0x160, 0x161],
  [0x178, 0x178],
  [0x17d, 0x17e],
  [0x2013, 0x2014],
  [0x2018, 0x201e],
  [0x2022, 0x2022],
  [0x2026, 0x2026],
  [0x20a0, 0x20cf],
  [0x2190, 0x2193],
]

const inPdfFont = (char: string) => {
  const code = char.codePointAt(0) ?? 0
  return PDF_FONT_RANGES.some(([from, to]) => code >= from && code <= to)
}

/** Text the PDF's font can write. */
export const pdfText = (text: string) =>
  Array.from(text).filter(inPdfFont).join('').replace(/ {2,}/g, ' ').trim()

interface Sum {
  currency: Currency
  count: number
  price: number
  extras: number
  income: number
  expenses: number
}

const extrasOf = (trip: Trip) =>
  trip.extras.reduce((sum, extra) => sum + extra.amount, 0)

/** The counted trips' sums, each currency apart; cancelled ones do not count. */
const sumsOf = (trips: readonly Trip[]): Sum[] => {
  const sums = new Map<Currency, Sum>()
  for (const trip of trips) {
    if (trip.status === 'cancelled') continue
    const sum = sums.get(trip.currency) ?? {
      currency: trip.currency,
      count: 0,
      price: 0,
      extras: 0,
      income: 0,
      expenses: 0,
    }
    sum.count += 1
    sum.price += trip.price
    sum.extras += extrasOf(trip)
    sum.income += tripIncome(trip)
    sum.expenses += trip.expensesTotal
    sums.set(trip.currency, sum)
  }
  return [...sums.values()]
}

const tripsText = (count: number) =>
  count === 1 ? '1 viaje' : `${String(count)} viajes`

/** "C$25,000.00": a cell's money, with its symbol (0041 RF-7). */
const cellMoney = (currency: Currency, amount: number) =>
  moneyAmount(currency, toCents(amount))

/** "C$73,000.00 NIO": a total's money, with its code too (0041 RF-7). */
const totalMoney = (currency: Currency, amount: number) =>
  moneyTotal(currency, toCents(amount))

/** The columns of each report (0040 RF-4, 0041 RF-2, RF-4). */
const headOf = (input: TripReportInput, numbered: boolean) => {
  const money = (column: string) => `${column} (${input.currency})`
  return input.kind === 'internal'
    ? [
        'Fecha',
        'Ruta',
        'Cliente',
        'Camión',
        'Remolque',
        'Conductor',
        'Estado',
        money('Ingresos'),
        money('Gastos'),
        money('Utilidad'),
      ]
    : [
        ...(numbered ? ['N.º'] : []),
        'Fecha',
        'Ruta',
        'Camión',
        'Remolque',
        'Conductor',
        money('Precio'),
        money('Otros ingresos'),
        money('Total'),
      ]
}

/** A trip as a row, with the names and plates the fleet has today. */
const rowOf = (
  trip: Trip,
  input: TripReportInput,
  numbered: boolean
): ReportRow => {
  const { names, plates } = input
  const internal = input.kind === 'internal'
  const money = (amount: number) => cellMoney(trip.currency, amount)
  const income = tripIncome(trip)
  const profit = income - trip.expensesTotal
  // Whose the equipment is stays inside: the client's support says only
  // its plates (owner, 2026-10-18)
  const owned = internal
    ? input.ownershipOf(trip)
    : { truck: null, trailer: null }
  const truck = thirdParty(
    plates.truck(trip.truckId, trip.truckName),
    owned.truck
  )
  const trailer =
    trip.trailerId && trip.trailerName
      ? thirdParty(
          plates.trailer(trip.trailerId, trip.trailerName),
          owned.trailer
        )
      : null
  const drivers = [
    names.driver(trip.driverId, trip.driverName),
    trip.secondDriverId && trip.secondDriverName
      ? names.driver(trip.secondDriverId, trip.secondDriverName)
      : null,
  ]
    .filter(Boolean)
    .join(' y ')
  const date = format(trip.startAt, 'd MMM yyyy', { locale: es })
  const route = routeName(trip.origin, trip.destination)
  const extras = extrasOf(trip)
  const cells =
    input.kind === 'internal'
      ? [
          date,
          route,
          names.client(trip.clientId, trip.clientName),
          truck ?? '',
          trailer ?? '',
          drivers,
          TRIP_STATUS_LABELS[trip.status],
          money(income),
          money(trip.expensesTotal),
          money(profit),
        ]
      : [
          ...(numbered ? [trip.tripNumber ?? ''] : []),
          date,
          route,
          truck ?? '',
          trailer ?? '',
          drivers,
          money(trip.price),
          extras === 0 ? '' : money(extras),
          money(income),
        ]
  return {
    cells: cells.map(pdfText),
    cancelled: trip.status === 'cancelled',
    losing:
      input.kind === 'internal' &&
      trip.status !== 'cancelled' &&
      toCents(profit) < 0,
  }
}

/** A subtotal or total row: its count, and its money with the code. */
const sumRows = (
  trips: readonly Trip[],
  label: string,
  kind: TripReportKind,
  moneyFrom: number
): ReportRow[] => {
  // The label and the count, then blanks up to the money
  const lead = (cells: string[]) => [
    ...cells,
    ...Array.from({ length: moneyFrom - cells.length }, () => ''),
  ]
  const sums = sumsOf(trips)
  if (sums.length === 0)
    return [
      {
        cells: [...lead([label, 'Ningún viaje cuenta']), '', '', ''],
        cancelled: false,
        losing: false,
      },
    ]
  return sums.map(sum => {
    const money =
      kind === 'internal'
        ? [sum.income, sum.expenses, sum.income - sum.expenses]
        : [sum.price, sum.extras, sum.income]
    return {
      cells: [
        ...lead([label, tripsText(sum.count)]),
        ...money.map(amount => totalMoney(sum.currency, amount)),
      ],
      cancelled: false,
      losing: kind === 'internal' && toCents(sum.income - sum.expenses) < 0,
    }
  })
}

/** What a trips' PDF says (0040 RF-3 to RF-6, 0041 RF-2 to RF-4). */
export const tripReport = (input: TripReportInput): TripReport => {
  const internal = input.kind === 'internal'
  // The support leaves the cancelled ones out (0041 RF-4)
  const trips = internal
    ? input.trips
    : input.trips.filter(trip => trip.status !== 'cancelled')
  const numbered = !internal && trips.some(trip => trip.tripNumber)
  const head = headOf(input, numbered)
  // The last three columns are money, in both
  const moneyFrom = head.length - 3
  const sums = sumsOf(trips)
  const counted = sums.reduce((count, sum) => count + sum.count, 0)
  const applied = internal
    ? [
        ...input.filters,
        ...(input.grouping ? [`Agrupado por ${input.grouping}`] : []),
        `Orden: ${input.order}`,
      ].join(' · ')
    : input.client
      ? `Cliente: ${input.client}`
      : ''
  const sum = (rows: readonly Trip[], label: string) =>
    sumRows(rows, label, input.kind, moneyFrom)
  return {
    kind: input.kind,
    title: internal ? 'Viajes' : 'Soporte de viajes',
    subtitle: pdfText(`${input.organization} · ${input.period}`),
    applied: pdfText(applied) || null,
    summary: internal
      ? [
          `${tripsText(counted)}, sin los cancelados`,
          ...sums.map(sum =>
            [
              `Ingresos ${totalMoney(sum.currency, sum.income)}`,
              `Gastos ${totalMoney(sum.currency, sum.expenses)}`,
              `Utilidad ${totalMoney(sum.currency, sum.income - sum.expenses)}`,
            ].join(' · ')
          ),
        ]
      : [
          tripsText(counted),
          ...sums.map(
            sum => `Total de ingresos ${totalMoney(sum.currency, sum.income)}`
          ),
        ],
    generated: `Generado el ${format(input.now, "d MMM yyyy 'a las' HH:mm", { locale: es })}`,
    head,
    moneyFrom,
    profitColumn: internal ? head.length - 1 : null,
    // The support is one table, whatever the grouping (0041 RF-4)
    sections:
      internal && input.groups
        ? input.groups.map(group => ({
            title: pdfText(group.title),
            subtitle: group.subtitle ? pdfText(group.subtitle) : null,
            rows: group.trips.map(trip => rowOf(trip, input, numbered)),
            subtotal: sum(group.trips, 'Subtotal'),
          }))
        : [
            {
              title: null,
              subtitle: null,
              rows: trips.map(trip => rowOf(trip, input, numbered)),
              subtotal: [],
            },
          ],
    total: sum(trips, 'Total'),
  }
}

/**
 * solo-camioneros-viajes-flota-de-cesar-2026-10-01_2026-10-31.pdf, or
 * solo-camioneros-soporte-viajes-… for the client (0040 RF-2, 0041 RF-6).
 */
export const tripReportFileName = (
  kind: TripReportKind,
  period: Period,
  organization: string
) =>
  [
    'solo-camioneros',
    kind === 'client' ? 'soporte-viajes' : 'viajes',
    slug(organization),
    `${format(period.start, 'yyyy-MM-dd')}_${format(period.end, 'yyyy-MM-dd')}`,
  ]
    .filter(Boolean)
    .join('-') + '.pdf'
