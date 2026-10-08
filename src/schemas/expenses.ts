// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import type { Currency } from 'schemas/account'
import type { Driver } from 'schemas/drivers'
import type { ExpenseCategory } from 'schemas/expenseCategories'
import type { Trailer, Truck } from 'schemas/fleet'
import { routeName } from 'schemas/rates'
import {
  amountIssue,
  expenseDateIssue,
  toCents,
  TRIP_LIMITS,
  type Trip,
  type TripFormValues,
} from 'schemas/trips'
import { fromDateTimeValue, toDateTimeValue } from 'utils/dateTimeValue'
import { formatEditable } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'

/** Mirrors the rules of `expenses` (backend specs/0026 RF-2). */
export const EXPENSE_LIMITS = { description: TRIP_LIMITS.expenseDescription }

export const EXPENSE_KINDS = ['trip', 'truck', 'trailer', 'general'] as const
export type ExpenseKind = (typeof EXPENSE_KINDS)[number]

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  trip: 'Viaje',
  truck: 'Camión',
  trailer: 'Remolque',
  general: 'General',
}

export interface Expense {
  id: string
  orgId: string
  takenAt: Date
  amount: number
  /** The organization's when it was made; it does not change. */
  currency: Currency
  categoryId: string
  categoryName: string
  description: string | null
  kind: ExpenseKind
  tripId: string | null
  /** "Managua → San José" */
  tripRoute: string | null
  truckId: string | null
  truckName: string | null
  trailerId: string | null
  trailerName: string | null
  driverId: string | null
  driverName: string | null
  receiptPhotoPath: string | null
  /**
   * The refuel that made it (specs/0027 RF-1): its amount, date and category
   * follow the refuel, and only its link and description change here.
   */
  refuelId: string | null
  /** When it was added; null while it waits for the server. */
  createdAt: Date | null
  createdBy: string
}

const issueAt = (
  ctx: { issues: unknown[] },
  values: unknown,
  path: (string | number)[],
  message: string
) => {
  ctx.issues.push({ code: 'custom', input: values, path, message })
}

export const expenseFormSchema = z
  .object({
    takenAt: z.string(),
    amount: z.string(),
    categoryId: z.string(),
    description: z.string().check(
      z.trim(),
      z.maxLength(EXPENSE_LIMITS.description, {
        error: `Usa ${String(EXPENSE_LIMITS.description)} caracteres como máximo`,
      })
    ),
    kind: z.enum(EXPENSE_KINDS),
    tripId: z.string(),
    truckId: z.string(),
    trailerId: z.string(),
    driverId: z.string(),
  })
  .check(
    z.superRefine((values, ctx) => {
      const date = expenseDateIssue(values.takenAt)
      if (date) issueAt(ctx, values, ['takenAt'], date)
      const amount = amountIssue(values.amount)
      if (amount) issueAt(ctx, values, ['amount'], amount)
      if (!values.categoryId)
        issueAt(ctx, values, ['categoryId'], 'Elige la categoría')
      if (values.kind === 'trip' && !values.tripId)
        issueAt(ctx, values, ['tripId'], 'Elige el viaje')
      if (values.kind === 'truck' && !values.truckId)
        issueAt(ctx, values, ['truckId'], 'Elige el camión')
      if (values.kind === 'trailer' && !values.trailerId)
        issueAt(ctx, values, ['trailerId'], 'Elige el remolque')
    })
  )

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>

export const EMPTY_EXPENSE_FORM = (
  now: Date,
  tripId: string | null = null
): ExpenseFormValues => ({
  takenAt: toDateTimeValue(now),
  amount: '',
  categoryId: '',
  description: '',
  kind: tripId ? 'trip' : 'truck',
  tripId: tripId ?? '',
  truckId: '',
  trailerId: '',
  driverId: '',
})

export const expenseToForm = (expense: Expense): ExpenseFormValues => ({
  takenAt: toDateTimeValue(expense.takenAt),
  amount: formatEditable(expense.amount),
  categoryId: expense.categoryId,
  description: expense.description ?? '',
  kind: expense.kind,
  tripId: expense.tripId ?? '',
  truckId: expense.truckId ?? '',
  trailerId: expense.trailerId ?? '',
  driverId: expense.driverId ?? '',
})

/** What the form needs to turn its values into the fields written. */
export interface ExpenseContext {
  currency: Currency
  categories: readonly ExpenseCategory[]
  trucks: readonly Truck[]
  trailers: readonly Trailer[]
  drivers: readonly Driver[]
}

const nameOf = (
  items: readonly { id: string; name: string }[],
  id: string | null
) => (id ? (items.find(item => item.id === id)?.name ?? null) : null)

/** A trip's side of an expense: its route, truck and trailer (RF-2). */
export const tripLink = (trip: Trip) => ({
  kind: 'trip' as const,
  tripId: trip.id,
  tripRoute: routeName(trip.origin, trip.destination),
  truckId: trip.truckId,
  truckName: trip.truckName,
  trailerId: trip.trailerId,
  trailerName: trip.trailerName,
})

/** The link an expense has now. */
const linkOf = (expense: Expense) => ({
  kind: expense.kind,
  tripId: expense.tripId,
  tripRoute: expense.tripRoute,
  truckId: expense.truckId,
  truckName: expense.truckName,
  trailerId: expense.trailerId,
  trailerName: expense.trailerName,
})

/**
 * Whether a trip's expense can be saved: its trip is at hand, or it is the
 * one it already had (audit 0027).
 */
export const tripIsAtHand = (
  values: Pick<ExpenseFormValues, 'kind' | 'tripId'>,
  trip: Trip | null,
  previous: Pick<Expense, 'kind' | 'tripId'> | null
) =>
  values.kind !== 'trip' ||
  trip !== null ||
  (previous?.kind === 'trip' && previous.tripId === values.tripId)

export const TRIP_NOT_AT_HAND =
  'Espera a que carguen los viajes y vuelve a elegirlo'

const NO_LINK = {
  tripId: null,
  tripRoute: null,
  truckId: null,
  truckName: null,
  trailerId: null,
  trailerName: null,
}

/**
 * The fields written (RF-2). Assumes valid values; a trip's expense needs
 * its trip. An expense that kept a deleted trip's trailer keeps it while it
 * stays on the same truck.
 */
export const expenseFromForm = (
  values: ExpenseFormValues,
  context: ExpenseContext,
  trip: Trip | null,
  previous: Expense | null = null
) => {
  // A trip's expense whose trip is not at hand (still reading, offline)
  // keeps the link it has: it never falls into another kind (audit 0027)
  const keptTrip =
    values.kind === 'trip' &&
    !trip &&
    previous?.kind === 'trip' &&
    previous.tripId === values.tripId
  const link =
    values.kind === 'trip' && trip
      ? tripLink(trip)
      : keptTrip
        ? linkOf(previous)
        : values.kind === 'truck'
          ? {
              ...NO_LINK,
              kind: 'truck' as const,
              truckId: values.truckId,
              truckName: nameOf(context.trucks, values.truckId) ?? '',
              ...(previous?.kind === 'truck' &&
                previous.truckId === values.truckId && {
                  trailerId: previous.trailerId,
                  trailerName: previous.trailerName,
                }),
            }
          : values.kind === 'trailer'
            ? {
                ...NO_LINK,
                kind: 'trailer' as const,
                trailerId: values.trailerId,
                trailerName: nameOf(context.trailers, values.trailerId) ?? '',
              }
            : { ...NO_LINK, kind: 'general' as const }
  const driverId = values.driverId || null
  return {
    takenAt: fromDateTimeValue(values.takenAt) ?? new Date(),
    amount: toCents(parseDecimal(values.amount)),
    currency: previous?.currency ?? context.currency,
    categoryId: values.categoryId,
    // The saved name stays if the category is no longer at hand
    categoryName:
      nameOf(context.categories, values.categoryId) ??
      (previous?.categoryId === values.categoryId ? previous.categoryName : ''),
    description: values.description.trim() || null,
    ...link,
    driverId,
    driverName:
      nameOf(context.drivers, driverId) ??
      (driverId && previous?.driverId === driverId
        ? previous.driverName
        : null),
    receiptPhotoPath: previous?.receiptPhotoPath ?? null,
  }
}

export type ExpenseFields = ReturnType<typeof expenseFromForm>

/** A row of "Gastos (opcional)" in the trip's form (RF-12). */
export type TripExpenseRow = TripFormValues['expenses'][number]

export const expenseToRow = (expense: Expense): TripExpenseRow => ({
  id: expense.id,
  categoryId: expense.categoryId,
  amount: formatEditable(expense.amount),
  takenAt: toDateTimeValue(expense.takenAt),
  description: expense.description ?? '',
})

// What follows the trip: the backend moves it when the trip changes
const LINK_KEYS = new Set<string>([
  'kind',
  'tripId',
  'tripRoute',
  'truckId',
  'truckName',
  'trailerId',
  'trailerName',
])

/**
 * Whether a row is as it was. Its link does not count: when the trip
 * changes truck or route the backend moves its expenses, so the batch
 * carries only the rows the user changed and stays within the rules' 20
 * reads (audit 0027).
 */
const sameFields = (expense: Expense, fields: ExpenseFields) =>
  (Object.keys(fields) as (keyof ExpenseFields)[])
    .filter(key => !LINK_KEYS.has(key))
    .every(key => {
      const before = expense[key]
      const after = fields[key]
      return before instanceof Date && after instanceof Date
        ? before.getTime() === after.getTime()
        : before === after
    })

/**
 * What saving a trip writes of its expenses (RF-12): the new rows, the
 * changed ones (driver and photo kept) and the removed ones; plus every
 * row as it will be, to show at once.
 */
export const tripExpenseChanges = (
  rows: readonly TripExpenseRow[],
  trip: Trip,
  previous: readonly Expense[],
  context: ExpenseContext,
  uid: string
) => {
  const before = new Map(previous.map(expense => [expense.id, expense]))
  const create: { id: string; fields: ExpenseFields }[] = []
  const update: { id: string; fields: ExpenseFields }[] = []
  const saved: Expense[] = []
  for (const row of rows) {
    const old = before.get(row.id) ?? null
    const fields = expenseFromForm(
      {
        ...row,
        kind: 'trip',
        tripId: trip.id,
        truckId: '',
        trailerId: '',
        driverId: old?.driverId ?? '',
      },
      context,
      trip,
      old
    )
    if (!old) create.push({ id: row.id, fields })
    else if (!sameFields(old, fields)) update.push({ id: row.id, fields })
    saved.push({
      id: row.id,
      orgId: trip.orgId,
      refuelId: null,
      createdAt: old?.createdAt ?? null,
      createdBy: old?.createdBy ?? uid,
      ...fields,
    })
  }
  const kept = new Set(rows.map(row => row.id))
  const remove = previous
    .filter(expense => !kept.has(expense.id))
    .map(expense => expense.id)
  return { create, update, remove, saved }
}

/** "Viaje Managua → San José", "Camión Unidad 12", "General" (RF-9). */
export const expenseLinkText = (
  expense: Pick<Expense, 'kind' | 'tripRoute' | 'truckName' | 'trailerName'>
) =>
  expense.kind === 'trip'
    ? `Viaje ${expense.tripRoute ?? ''}`
    : expense.kind === 'truck'
      ? `Camión ${expense.truckName ?? ''}`
      : expense.kind === 'trailer'
        ? `Remolque ${expense.trailerName ?? ''}`
        : 'General'

/** Totals by category, largest first (RF-9, RF-13), each currency apart. */
export const totalsByCategory = (
  expenses: readonly Pick<
    Expense,
    'categoryId' | 'categoryName' | 'amount' | 'currency'
  >[],
  currentName: (categoryId: string) => string | null = () => null
) => {
  const totals = new Map<
    string,
    { name: string; currency: Currency; amount: number }
  >()
  for (const expense of expenses) {
    const key = `${expense.categoryId}|${expense.currency}`
    const total = totals.get(key) ?? {
      name: currentName(expense.categoryId) ?? expense.categoryName,
      currency: expense.currency,
      amount: 0,
    }
    total.amount = toCents(total.amount + expense.amount)
    totals.set(key, total)
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount)
}

/** The sum of some expenses, each currency apart: ["C$42,300.00 NIO"]. */
export const totalsByCurrency = (
  expenses: readonly Pick<Expense, 'amount' | 'currency'>[]
) => {
  const totals = new Map<Currency, number>()
  for (const expense of expenses) {
    totals.set(
      expense.currency,
      toCents((totals.get(expense.currency) ?? 0) + expense.amount)
    )
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount }))
}

// ---- A refuel's expense (specs/0027) --------------------------------------

/** The refuel behind an expense: what limits what it can belong to. */
export interface RefuelOfExpense {
  tankName: string
  equipment: { kind: 'truck' | 'trailer' | 'none'; id: string | null }
}

export const isRefuelExpense = (expense: Pick<Expense, 'refuelId'>) =>
  expense.refuelId !== null

/** What it is without a trip: its truck, its trailer or general (RF-3). */
export const refuelBaseKind = (
  equipment: RefuelOfExpense['equipment']
): ExpenseKind =>
  equipment.id && equipment.kind !== 'none' ? equipment.kind : 'general'

/** Whether a trip carries the refuel's truck or trailer (RF-6). */
export const tripCarriesRefuel = (
  trip: Pick<Trip, 'truckId' | 'trailerId'>,
  equipment: RefuelOfExpense['equipment']
) =>
  (equipment.kind === 'truck' && trip.truckId === equipment.id) ||
  (equipment.kind === 'trailer' && trip.trailerId === equipment.id)

export const refuelExpenseFormSchema = z
  .object({
    kind: z.enum(EXPENSE_KINDS),
    tripId: z.string(),
    description: z.string().check(
      z.trim(),
      z.maxLength(EXPENSE_LIMITS.description, {
        error: `Usa ${String(EXPENSE_LIMITS.description)} caracteres como máximo`,
      })
    ),
  })
  .check(
    z.superRefine((values, ctx) => {
      if (values.kind === 'trip' && !values.tripId)
        issueAt(ctx, values, ['tripId'], 'Elige el viaje')
    })
  )

export type RefuelExpenseFormValues = z.infer<typeof refuelExpenseFormSchema>

/**
 * The changes of a refuel's expense (RF-6, RF-9): what it belongs to and
 * its description, nothing else. `equipmentName` names its truck or
 * trailer when it goes back to it.
 */
export const refuelExpenseChanges = (
  values: RefuelExpenseFormValues,
  refuel: RefuelOfExpense,
  trip: Trip | null,
  equipmentName: string | null,
  previous: Expense | null = null
) => {
  const { kind, id } = refuel.equipment
  const link =
    values.kind === 'trip' && trip
      ? tripLink(trip)
      : values.kind === 'trip' &&
          previous?.kind === 'trip' &&
          previous.tripId === values.tripId
        ? linkOf(previous)
        : kind === 'truck' && id
          ? {
              ...NO_LINK,
              kind: 'truck' as const,
              truckId: id,
              truckName: equipmentName ?? 'Camión',
            }
          : kind === 'trailer' && id
            ? {
                ...NO_LINK,
                kind: 'trailer' as const,
                trailerId: id,
                trailerName: equipmentName ?? 'Remolque',
              }
            : { ...NO_LINK, kind: 'general' as const }
  return { ...link, description: values.description.trim() || null }
}

export type RefuelExpenseChanges = ReturnType<typeof refuelExpenseChanges>
