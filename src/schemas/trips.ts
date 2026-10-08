// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import type { Currency } from 'schemas/account'
import type { Client } from 'schemas/clients'
import type { Driver } from 'schemas/drivers'
import type { Trailer, Truck } from 'schemas/fleet'
import type { Rate } from 'schemas/rates'
import { fromDateTimeValue, toDateTimeValue } from 'utils/dateTimeValue'
import { formatEditable } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'
import { tripPeriod, type TripPeriod } from 'utils/tripPeriod'

/** Mirrors the rules of `trips` (backend specs/0025 RF-1). */
export const TRIP_LIMITS = {
  place: 80,
  amountMax: 100_000_000,
  extras: 10,
  extraDescription: 80,
  // The trip and its expenses go in one batch, where the rules may read
  // at most 20 documents: 10 categories fit beside the trip's (specs/0026)
  expenses: 10,
  expenseDescription: 200,
  tripNumber: 20,
  description: 500,
  notes: 1000,
}

export const TRIP_STATUSES = [
  'scheduled',
  'in_progress',
  'done',
  'cancelled',
] as const
export type TripStatus = (typeof TRIP_STATUSES)[number]

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  scheduled: 'Programado',
  in_progress: 'En curso',
  done: 'Terminado',
  cancelled: 'Cancelado',
}

export interface TripExtra {
  description: string
  amount: number
}

export interface Trip extends TripPeriod {
  id: string
  orgId: string
  status: TripStatus
  startAt: Date
  endAt: Date | null
  mode: 'rate' | 'manual'
  rateId: string | null
  origin: string
  destination: string
  price: number
  extras: TripExtra[]
  /** The organization's when it was made; it does not change (RF-2). */
  currency: Currency
  clientId: string
  clientName: string
  truckId: string
  truckName: string
  trailerId: string | null
  trailerName: string | null
  driverId: string
  driverName: string
  secondDriverId: string | null
  secondDriverName: string | null
  driverIds: string[]
  /** Its expenses' total, kept by the backend (specs/0026 RF-3). */
  expensesTotal: number
  tripNumber: string | null
  description: string | null
  notes: string | null
  /** When it was added; null while it waits for the server. */
  createdAt: Date | null
  createdBy: string
}

/** Price plus the extras (specs/0025): what the trip brings in. */
export const tripIncome = (trip: Pick<Trip, 'price' | 'extras'>) =>
  Math.round(
    (trip.price + trip.extras.reduce((sum, extra) => sum + extra.amount, 0)) *
      100
  ) / 100

/** Stored with 2 decimals, like every amount (specs/0012). */
export const toCents = (value: number) => Math.round(value * 100) / 100

/** The rules take an expense up to a day ahead (backend specs/0026 RF-2). */
export const isTooLate = (date: Date, now = new Date()) =>
  date.getTime() > now.getTime() + 24 * 60 * 60 * 1000

/** What is wrong with an expense's typed date, or null (specs/0026). */
export const expenseDateIssue = (value: string): string | null => {
  const date = fromDateTimeValue(value)
  if (!date) return 'Escribe la fecha y hora'
  if (isTooLate(date)) return 'La fecha no puede ser futura'
  return null
}

/** What is wrong with a typed amount, or null (specs/0025, 0026). */
export const amountIssue = (value: string): string | null => {
  if (value.trim() === '') return 'Escribe el monto'
  const amount = parseDecimal(value)
  if (Number.isNaN(amount)) return 'Escribe solo números, por ejemplo 2,500'
  if (toCents(amount) <= 0) return 'Ingresa un monto mayor que 0'
  if (amount > TRIP_LIMITS.amountMax) return 'El monto es demasiado alto'
  return null
}

const text = (max: number) =>
  z
    .string()
    .check(
      z.trim(),
      z.maxLength(max, { error: `Usa ${String(max)} caracteres como máximo` })
    )

export const tripFormSchema = z
  .object({
    status: z.enum(TRIP_STATUSES),
    clientId: z.string(),
    mode: z.enum(['rate', 'manual']),
    rateId: z.string(),
    origin: text(TRIP_LIMITS.place),
    destination: text(TRIP_LIMITS.place),
    price: z.string(),
    extras: z.array(z.object({ description: z.string(), amount: z.string() })),
    // Its expenses, created, changed or deleted with it (specs/0026 RF-12)
    expenses: z.array(
      z.object({
        id: z.string(),
        categoryId: z.string(),
        amount: z.string(),
        takenAt: z.string(),
        description: z.string(),
      })
    ),
    truckId: z.string(),
    trailerId: z.string(),
    driverId: z.string(),
    secondDriverId: z.string(),
    startAt: z.string(),
    endAt: z.string(),
    tripNumber: text(TRIP_LIMITS.tripNumber),
    description: text(TRIP_LIMITS.description),
    notes: text(TRIP_LIMITS.notes),
  })
  .check(
    z.superRefine((values, ctx) => {
      const issue = (path: (string | number)[], message: string) => {
        ctx.issues.push({ code: 'custom', input: values, path, message })
      }
      if (!values.clientId) issue(['clientId'], 'Elige el cliente')
      if (values.mode === 'rate') {
        if (!values.rateId) issue(['rateId'], 'Elige la tarifa')
      } else {
        if (!values.origin.trim()) issue(['origin'], 'Escribe el origen')
        if (!values.destination.trim())
          issue(['destination'], 'Escribe el destino')
        const price = amountIssue(values.price)
        if (price) issue(['price'], price.replace('el monto', 'el precio'))
      }
      values.extras.forEach((extra, index) => {
        const description = extra.description.trim()
        if (!description)
          issue(['extras', index, 'description'], 'Escribe qué es')
        else if (description.length > TRIP_LIMITS.extraDescription)
          issue(
            ['extras', index, 'description'],
            `Usa ${String(TRIP_LIMITS.extraDescription)} caracteres como máximo`
          )
        const amount = amountIssue(extra.amount)
        if (amount) issue(['extras', index, 'amount'], amount)
      })
      values.expenses.forEach((expense, index) => {
        if (!expense.categoryId)
          issue(['expenses', index, 'categoryId'], 'Elige la categoría')
        const amount = amountIssue(expense.amount)
        if (amount) issue(['expenses', index, 'amount'], amount)
        const date = expenseDateIssue(expense.takenAt)
        if (date) issue(['expenses', index, 'takenAt'], date)
        if (expense.description.trim().length > TRIP_LIMITS.expenseDescription)
          issue(
            ['expenses', index, 'description'],
            `Usa ${String(TRIP_LIMITS.expenseDescription)} caracteres como máximo`
          )
      })
      if (!values.truckId) issue(['truckId'], 'Elige el camión')
      if (!values.driverId) issue(['driverId'], 'Elige el conductor')
      if (values.secondDriverId && values.secondDriverId === values.driverId)
        issue(['secondDriverId'], 'Elige otro conductor')
      const start = fromDateTimeValue(values.startAt)
      if (!start) issue(['startAt'], 'Escribe la fecha y hora de inicio')
      const end = values.endAt ? fromDateTimeValue(values.endAt) : null
      if (values.endAt && !end)
        issue(['endAt'], 'Escribe una fecha y hora válidas')
      if (start && end && end < start)
        issue(['endAt'], 'El fin no puede ser antes del inicio')
      if (values.status === 'done' && !values.endAt)
        issue(['endAt'], 'Para terminarlo, pon la fecha y hora de fin')
    })
  )

export type TripFormValues = z.infer<typeof tripFormSchema>

/** What the form needs to turn its values into the fields written. */
export interface TripContext {
  currency: Currency
  clients: readonly Client[]
  trucks: readonly Truck[]
  trailers: readonly Trailer[]
  drivers: readonly Driver[]
  rates: readonly Rate[]
}

const nameOf = (items: readonly { id: string; name: string }[], id: string) =>
  items.find(item => item.id === id)?.name ?? null

/**
 * The fields written (RF-1): the rate's route and price copied, the names
 * copied, the period worked out from the start. Assumes valid values. An
 * edited trip that keeps its rate keeps the copy it has, even if the rate
 * changed since (owner, 2026-10-07).
 */
export const tripFromForm = (
  values: TripFormValues,
  context: TripContext,
  previous: Trip | null = null
) => {
  const keptRate =
    previous !== null &&
    values.mode === 'rate' &&
    previous.mode === 'rate' &&
    previous.rateId === values.rateId
  const rate = keptRate
    ? {
        id: previous.rateId ?? '',
        origin: previous.origin,
        destination: previous.destination,
        price: previous.price,
      }
    : values.mode === 'rate'
      ? (context.rates.find(item => item.id === values.rateId) ?? null)
      : null
  const startAt = fromDateTimeValue(values.startAt) ?? new Date()
  const endAt = values.endAt ? fromDateTimeValue(values.endAt) : null
  const secondDriverId = values.secondDriverId || null
  const trailerId = values.trailerId || null
  return {
    status: values.status,
    startAt,
    endAt,
    ...tripPeriod(startAt),
    mode: rate ? ('rate' as const) : ('manual' as const),
    rateId: rate?.id ?? null,
    origin: rate?.origin ?? values.origin.trim(),
    destination: rate?.destination ?? values.destination.trim(),
    price: rate?.price ?? toCents(parseDecimal(values.price)),
    extras: values.extras.map(extra => ({
      description: extra.description.trim(),
      amount: toCents(parseDecimal(extra.amount)),
    })),
    currency: previous?.currency ?? context.currency,
    clientId: values.clientId,
    clientName: nameOf(context.clients, values.clientId) ?? '',
    truckId: values.truckId,
    truckName: nameOf(context.trucks, values.truckId) ?? '',
    trailerId,
    trailerName: trailerId ? nameOf(context.trailers, trailerId) : null,
    driverId: values.driverId,
    driverName: nameOf(context.drivers, values.driverId) ?? '',
    secondDriverId,
    secondDriverName: secondDriverId
      ? nameOf(context.drivers, secondDriverId)
      : null,
    driverIds: secondDriverId
      ? [values.driverId, secondDriverId]
      : [values.driverId],
    tripNumber: values.tripNumber.trim() || null,
    description: values.description.trim() || null,
    notes: values.notes.trim() || null,
  }
}

export type TripFields = ReturnType<typeof tripFromForm>

export const EMPTY_TRIP_FORM = (now: Date): TripFormValues => ({
  status: 'scheduled',
  clientId: '',
  mode: 'rate',
  rateId: '',
  origin: '',
  destination: '',
  price: '',
  extras: [],
  expenses: [],
  truckId: '',
  trailerId: '',
  driverId: '',
  secondDriverId: '',
  startAt: toDateTimeValue(now),
  endAt: '',
  tripNumber: '',
  description: '',
  notes: '',
})

export const tripToForm = (trip: Trip): TripFormValues => ({
  status: trip.status,
  clientId: trip.clientId,
  mode: trip.mode,
  rateId: trip.rateId ?? '',
  origin: trip.origin,
  destination: trip.destination,
  price: formatEditable(trip.price),
  extras: trip.extras.map(extra => ({
    description: extra.description,
    amount: formatEditable(extra.amount),
  })),
  // Filled by the form with the trip's expenses, once read (specs/0026)
  expenses: [],
  truckId: trip.truckId,
  trailerId: trip.trailerId ?? '',
  driverId: trip.driverId,
  secondDriverId: trip.secondDriverId ?? '',
  startAt: toDateTimeValue(trip.startAt),
  endAt: trip.endAt ? toDateTimeValue(trip.endAt) : '',
  tripNumber: trip.tripNumber ?? '',
  description: trip.description ?? '',
  notes: trip.notes ?? '',
})
