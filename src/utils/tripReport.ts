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
import { formatNumber } from 'utils/formatNumber'
import { thirdParty } from 'utils/ownership'
import type { TripGroup, TripNames, TripOwnershipOf } from 'utils/tripGroups'

// What the trips' PDF says (backend specs/0040), pure: the page gives what
// it shows, and services/tripPdf only draws it

export const TRIP_REPORT_COLUMNS = [
  'Fecha',
  'Ruta',
  'Cliente',
  'Camión',
  'Conductor',
  'Estado',
  'Ingresos',
  'Gastos',
  'Utilidad',
] as const

/** The first column of money: these three go right-aligned (RF-4). */
export const FIRST_MONEY_COLUMN = 6

export interface ReportRow {
  cells: string[]
  /** Shown, but not counted (RF-4). */
  cancelled: boolean
  /** Its profit is below zero: red (RF-7). */
  losing: boolean
}

export interface ReportSection {
  /** A group's title and subtitle; null without grouping (RF-5). */
  title: string | null
  subtitle: string | null
  rows: ReportRow[]
  /** Its subtotal, one row per currency; none without grouping. */
  subtotal: ReportRow[]
}

export interface TripReport {
  title: string
  /** "Flota de Cesar · 1 oct – 31 oct 2026" */
  subtitle: string
  /** "Cliente: Walmart · Agrupado por Camión · Orden: Precio, mayor primero" */
  applied: string | null
  /** The summary, as on the screen: one line per currency (RF-3). */
  summary: string[]
  generated: string
  /** "Ingresos (NIO)": the money columns' headers (RF-8). */
  head: string[]
  sections: ReportSection[]
  total: ReportRow[]
}

export interface TripReportInput {
  organization: string
  period: string
  /** The trips shown, filtered and in their order. */
  trips: readonly Trip[]
  /** The groups shown, or null without grouping. */
  groups: readonly TripGroup[] | null
  /** "Cliente: Walmart", one per filter on. */
  filters: readonly string[]
  /** "Camión", or null without grouping. */
  grouping: string | null
  /** "Fecha, más reciente primero" */
  order: string
  names: TripNames
  ownershipOf: TripOwnershipOf
  /** The organization's: the money columns are in it (RF-8). */
  currency: Currency
  now: Date
}

// Helvetica, the PDF's standard font, writes Windows-1252 (WinAnsi): its
// Latin letters and a few signs. Anything else (an emoji) is dropped (RF-8)
const NOT_WIN_ANSI = /[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu

/** Text the PDF's font can write: "→" is "–", the rest dropped. */
export const pdfText = (text: string) =>
  text.replaceAll('→', '–').replace(NOT_WIN_ANSI, '').trim()

/** "25,000.00", or "-300.00": no symbol, the font may lack it (RF-8). */
const amount = (value: number) => formatNumber(toCents(value), 2)

interface Sum {
  currency: Currency
  count: number
  income: number
  expenses: number
}

/** The counted trips' sums, each currency apart; cancelled ones do not count. */
const sumsOf = (trips: readonly Trip[]): Sum[] => {
  const sums = new Map<Currency, Sum>()
  for (const trip of trips) {
    if (trip.status === 'cancelled') continue
    const sum = sums.get(trip.currency) ?? {
      currency: trip.currency,
      count: 0,
      income: 0,
      expenses: 0,
    }
    sum.count += 1
    sum.income += tripIncome(trip)
    sum.expenses += trip.expensesTotal
    sums.set(trip.currency, sum)
  }
  return [...sums.values()]
}

const tripsText = (count: number) =>
  count === 1 ? '1 viaje' : `${String(count)} viajes`

/** A trip as a row, with the names the screen shows. */
const rowOf = (trip: Trip, input: TripReportInput): ReportRow => {
  const { names, currency } = input
  const owned = input.ownershipOf(trip)
  const money = (value: number) =>
    trip.currency === currency
      ? amount(value)
      : `${amount(value)} ${trip.currency}`
  const income = tripIncome(trip)
  const profit = income - trip.expensesTotal
  const truck = thirdParty(
    names.truck(trip.truckId, trip.truckName),
    owned.truck
  )
  const trailer =
    trip.trailerId && trip.trailerName
      ? thirdParty(
          names.trailer(trip.trailerId, trip.trailerName),
          owned.trailer
        )
      : null
  const drivers = [
    names.driver(trip.driverId, trip.driverName),
    trip.secondDriverId && trip.secondDriverName
      ? names.driver(trip.secondDriverId, trip.secondDriverName)
      : null,
  ].filter(Boolean)
  return {
    cells: [
      format(trip.startAt, 'd MMM yyyy', { locale: es }),
      routeName(trip.origin, trip.destination),
      names.client(trip.clientId, trip.clientName),
      [truck, trailer].filter(Boolean).join(' · '),
      drivers.join(' y '),
      TRIP_STATUS_LABELS[trip.status],
      money(income),
      money(trip.expensesTotal),
      money(profit),
    ].map(pdfText),
    cancelled: trip.status === 'cancelled',
    losing: trip.status !== 'cancelled' && toCents(profit) < 0,
  }
}

/** A subtotal or total row: its count, and its money with the code. */
const sumRows = (trips: readonly Trip[], label: string): ReportRow[] => {
  const sums = sumsOf(trips)
  if (sums.length === 0)
    return [
      {
        cells: [label, 'Ningún viaje cuenta', '', '', '', '', '', '', ''],
        cancelled: false,
        losing: false,
      },
    ]
  return sums.map(sum => ({
    cells: [
      label,
      tripsText(sum.count),
      '',
      '',
      '',
      '',
      `${amount(sum.income)} ${sum.currency}`,
      `${amount(sum.expenses)} ${sum.currency}`,
      `${amount(sum.income - sum.expenses)} ${sum.currency}`,
    ],
    cancelled: false,
    losing: toCents(sum.income - sum.expenses) < 0,
  }))
}

/** What the trips' PDF says (RF-3 to RF-8). */
export const tripReport = (input: TripReportInput): TripReport => {
  const sums = sumsOf(input.trips)
  const counted = sums.reduce((count, sum) => count + sum.count, 0)
  const applied = [
    ...input.filters,
    ...(input.grouping ? [`Agrupado por ${input.grouping}`] : []),
    `Orden: ${input.order}`,
  ]
  return {
    title: 'Viajes',
    subtitle: pdfText(`${input.organization} · ${input.period}`),
    applied: pdfText(applied.join(' · ')) || null,
    summary: [
      `${tripsText(counted)}, sin los cancelados`,
      ...sums.map(sum =>
        [
          `Ingresos ${amount(sum.income)} ${sum.currency}`,
          `Gastos ${amount(sum.expenses)} ${sum.currency}`,
          `Utilidad ${amount(sum.income - sum.expenses)} ${sum.currency}`,
        ].join(' · ')
      ),
    ],
    generated: `Generado el ${format(input.now, "d MMM yyyy 'a las' HH:mm", { locale: es })}`,
    head: TRIP_REPORT_COLUMNS.map((column, index) =>
      index >= FIRST_MONEY_COLUMN ? `${column} (${input.currency})` : column
    ),
    sections: input.groups
      ? input.groups.map(group => ({
          title: pdfText(group.title),
          subtitle: group.subtitle ? pdfText(group.subtitle) : null,
          rows: group.trips.map(trip => rowOf(trip, input)),
          subtotal: sumRows(group.trips, 'Subtotal'),
        }))
      : [
          {
            title: null,
            subtitle: null,
            rows: input.trips.map(trip => rowOf(trip, input)),
            subtotal: [],
          },
        ],
    total: sumRows(input.trips, 'Total'),
  }
}

/** solo-camioneros-viajes-flota-de-cesar-2026-10-01_2026-10-31.pdf (RF-2) */
export const tripReportFileName = (period: Period, organization: string) =>
  [
    'solo-camioneros',
    'viajes',
    slug(organization),
    `${format(period.start, 'yyyy-MM-dd')}_${format(period.end, 'yyyy-MM-dd')}`,
  ]
    .filter(Boolean)
    .join('-') + '.pdf'
