// Trips in Firestore (backend specs/0025). SDK imported statically: only
// lazy pages and the trips store (with import()) reach this module.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import * as z from 'zod/mini'
import { CURRENCIES } from 'schemas/account'
import {
  TRIP_LIMITS,
  TRIP_STATUSES,
  type Trip,
  type TripExtra,
  type TripFields,
} from 'schemas/trips'
import type { ExpenseFields } from 'schemas/expenses'
import { expenseChanges, newExpenseData } from 'services/expenses'
import { loadFirebase } from 'services/firebase'
import { reportError } from 'utils/reportError'
import { withTimeout } from 'utils/withTimeout'

/** Read at once, so the totals and filters of a period are exact (RF-7). */
export const MAX_TRIPS_PER_PERIOD = 1000

const nullableString = z.nullable(z.string())
const schema = z.object({
  orgId: z.string(),
  status: z.enum(TRIP_STATUSES),
  startAt: z.instanceof(Timestamp),
  endAt: z.nullable(z.instanceof(Timestamp)),
  year: z.number(),
  month: z.number(),
  yearMonth: z.string(),
  monthLabel: z.string(),
  weekStart: z.string(),
  weekLabel: z.string(),
  mode: z.enum(['rate', 'manual']),
  rateId: nullableString,
  origin: z.string(),
  destination: z.string(),
  price: z.number(),
  extras: z.array(z.unknown()),
  currency: z.enum(CURRENCIES),
  clientId: z.string(),
  clientName: z.string(),
  truckId: z.string(),
  truckName: z.string(),
  trailerId: nullableString,
  trailerName: nullableString,
  // Trips from before specs/0035 lack them
  truckOwnership: z._default(z.nullable(z.enum(['own', 'third_party'])), null),
  trailerOwnership: z._default(
    z.nullable(z.enum(['own', 'third_party'])),
    null
  ),
  driverId: z.string(),
  driverName: z.string(),
  secondDriverId: nullableString,
  secondDriverName: nullableString,
  driverIds: z.array(z.string()),
  // Kept by the backend's trigger (specs/0026 RF-3); 0 until it runs
  expensesTotal: z._default(z.number(), 0),
  tripNumber: nullableString,
  description: nullableString,
  notes: nullableString,
  createdBy: z.string(),
})

const extraSchema = z.object({
  description: z
    .string()
    .check(z.minLength(1), z.maxLength(TRIP_LIMITS.extraDescription)),
  amount: z.number().check(z.positive(), z.lte(TRIP_LIMITS.amountMax)),
})

/**
 * The rules bound the extras' list but not each line (a rule may evaluate
 * at most 1000 expressions): a line written outside the app is left out.
 */
const toExtras = (raw: unknown[]): TripExtra[] =>
  raw.flatMap(item => {
    const parsed = extraSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })

const toTrip = (id: string, data: DocumentData): Trip | null => {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    reportError(parsed.error, { operation: 'parseTrip', id })
    return null
  }
  const { startAt, endAt, extras, ...rest } = parsed.data
  const createdAt: unknown = data.createdAt
  return {
    id,
    ...rest,
    startAt: startAt.toDate(),
    endAt: endAt?.toDate() ?? null,
    extras: toExtras(extras),
    // Pending server timestamp on a local write
    createdAt: createdAt instanceof Timestamp ? createdAt.toDate() : null,
  }
}

export interface TripsPage {
  items: Trip[]
  /** More than MAX_TRIPS_PER_PERIOD started in the period. */
  truncated: boolean
}

/** The organization's trips that start in the period, newest first. */
export const readTripsInPeriod = async (
  orgId: string,
  start: Date,
  end: Date
): Promise<TripsPage> => {
  const { db } = await loadFirebase()
  const snapshot = await withTimeout(
    getDocs(
      query(
        collection(db, 'trips'),
        where('orgId', '==', orgId),
        where('startAt', '>=', Timestamp.fromDate(start)),
        where('startAt', '<=', Timestamp.fromDate(end)),
        orderBy('startAt', 'desc'),
        limit(MAX_TRIPS_PER_PERIOD + 1)
      )
    ),
    'readTrips'
  )
  const items = snapshot.docs
    .slice(0, MAX_TRIPS_PER_PERIOD)
    .map(document => toTrip(document.id, document.data()))
    .filter((trip): trip is Trip => trip !== null)
  return { items, truncated: snapshot.size > MAX_TRIPS_PER_PERIOD }
}

/** One trip, for its screen when it is not in the period shown. */
export const readTrip = async (id: string): Promise<Trip | null> => {
  const { db } = await loadFirebase()
  const snapshot = await withTimeout(getDoc(doc(db, 'trips', id)), 'readTrip')
  const data = snapshot.data()
  return data ? toTrip(snapshot.id, data) : null
}

/**
 * The id of a new trip, made when its form opens: saving again writes the
 * same document (ADR 0003).
 */
export const newTripId = (): string => crypto.randomUUID().replaceAll('-', '')

const currentUid = async () => {
  const { auth } = await loadFirebase()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not signed in')
  return uid
}

const stored = (fields: TripFields) => ({
  ...fields,
  startAt: Timestamp.fromDate(fields.startAt),
  endAt: fields.endAt ? Timestamp.fromDate(fields.endAt) : null,
})

/** Settles when the server accepts it; offline it waits in the queue. */
export const createTrip = async (
  id: string,
  orgId: string,
  fields: TripFields
) => {
  const [{ db }, uid] = await Promise.all([loadFirebase(), currentUid()])
  await setDoc(doc(db, 'trips', id), {
    ...stored(fields),
    orgId,
    expensesTotal: 0,
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

export const updateTrip = async (id: string, fields: TripFields) => {
  const [{ db }, uid] = await Promise.all([loadFirebase(), currentUid()])
  await updateDoc(doc(db, 'trips', id), {
    ...stored(fields),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

export const deleteTrip = async (id: string) => {
  const { db } = await loadFirebase()
  await deleteDoc(doc(db, 'trips', id))
}

/** The expenses a trip's form adds, changes and removes (specs/0026 RF-12). */
export interface TripExpenseWrites {
  create: { id: string; fields: ExpenseFields }[]
  update: { id: string; fields: ExpenseFields }[]
  remove: string[]
}

/**
 * The trip and its expenses in one batch (RF-12): offline they wait
 * together, and the rules check each expense against the trip it goes with.
 */
export const saveTripWithExpenses = async (
  id: string,
  orgId: string,
  fields: TripFields,
  isNew: boolean,
  expenses: TripExpenseWrites
) => {
  const [{ db }, uid] = await Promise.all([loadFirebase(), currentUid()])
  const batch = writeBatch(db)
  const tripRef = doc(db, 'trips', id)
  if (isNew) {
    batch.set(tripRef, {
      ...stored(fields),
      orgId,
      expensesTotal: 0,
      createdAt: serverTimestamp(),
      createdBy: uid,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    })
  } else {
    batch.update(tripRef, {
      ...stored(fields),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    })
  }
  for (const expense of expenses.create) {
    batch.set(
      doc(db, 'expenses', expense.id),
      newExpenseData(orgId, uid, expense.fields)
    )
  }
  for (const expense of expenses.update) {
    batch.update(
      doc(db, 'expenses', expense.id),
      expenseChanges(uid, expense.fields)
    )
  }
  for (const expenseId of expenses.remove) {
    batch.delete(doc(db, 'expenses', expenseId))
  }
  await batch.commit()
}
