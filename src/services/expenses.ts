// Expenses and their categories in Firestore (backend specs/0026). SDK
// imported statically: only lazy pages and the expenses store (with
// import()) reach this module.
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
  presetCategoriesOf,
  type ExpenseCategory,
} from 'schemas/expenseCategories'
import {
  EXPENSE_KINDS,
  type Expense,
  type ExpenseFields,
  type RefuelExpenseChanges,
  type RefuelOfExpense,
} from 'schemas/expenses'
import { loadFirebase, loadStorage } from 'services/firebase'
import { compressImage } from 'utils/compressImage'
import { reportError } from 'utils/reportError'
import { withTimeout } from 'utils/withTimeout'

/** Read at once, so the totals and filters of a period are exact (RF-9). */
export const MAX_EXPENSES_PER_PERIOD = 1000

const currentUid = async () => {
  const { auth } = await loadFirebase()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not signed in')
  return uid
}

/**
 * An id made when a form opens: saving again writes the same document
 * (ADR 0003).
 */
export const newExpenseId = (): string =>
  crypto.randomUUID().replaceAll('-', '')

// ---- Categories (RF-1, RF-11) --------------------------------------------

const categorySchema = z.object({
  orgId: z.string(),
  name: z.string(),
  system: z.nullable(z.literal('fuel')),
  archived: z.boolean(),
})

export const readCategories = async (
  orgId: string
): Promise<ExpenseCategory[]> => {
  const { db } = await loadFirebase()
  const snapshot = await withTimeout(
    getDocs(
      query(
        collection(db, 'expenseCategories'),
        where('orgId', '==', orgId),
        limit(200)
      )
    ),
    'readExpenseCategories'
  )
  return snapshot.docs.flatMap(document => {
    const parsed = categorySchema.safeParse(document.data())
    if (!parsed.success) {
      reportError(parsed.error, { operation: 'parseExpenseCategory' })
      return []
    }
    return [{ id: document.id, ...parsed.data }]
  })
}

/**
 * The preset categories of an organization that has none (RF-1), with
 * their fixed ids: two phones seeding at once write the same documents.
 */
export const seedCategories = async (
  orgId: string
): Promise<ExpenseCategory[]> => {
  const [{ db }, uid] = await Promise.all([loadFirebase(), currentUid()])
  const batch = writeBatch(db)
  const categories = presetCategoriesOf(orgId)
  for (const { id, ...category } of categories) {
    batch.set(doc(db, 'expenseCategories', id), {
      ...category,
      createdAt: serverTimestamp(),
      createdBy: uid,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    })
  }
  // Offline it waits in the queue; the list shows them at once
  void batch.commit().catch((error: unknown) => {
    reportError(error, { operation: 'seedExpenseCategories' })
  })
  return categories
}

export const createCategory = async (
  id: string,
  orgId: string,
  name: string
) => {
  const [{ db }, uid] = await Promise.all([loadFirebase(), currentUid()])
  await setDoc(doc(db, 'expenseCategories', id), {
    orgId,
    name,
    system: null,
    archived: false,
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

export const updateCategory = async (
  id: string,
  changes: { name?: string; archived?: boolean }
) => {
  const [{ db }, uid] = await Promise.all([loadFirebase(), currentUid()])
  await updateDoc(doc(db, 'expenseCategories', id), {
    ...changes,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

// ---- Expenses (RF-2, RF-9, RF-10) ----------------------------------------

const nullableString = z.nullable(z.string())
const expenseSchema = z.object({
  orgId: z.string(),
  takenAt: z.instanceof(Timestamp),
  amount: z.number(),
  currency: z.enum(CURRENCIES),
  categoryId: z.string(),
  categoryName: z.string(),
  description: nullableString,
  kind: z.enum(EXPENSE_KINDS),
  tripId: nullableString,
  tripRoute: nullableString,
  truckId: nullableString,
  truckName: nullableString,
  trailerId: nullableString,
  trailerName: nullableString,
  driverId: nullableString,
  driverName: nullableString,
  receiptPhotoPath: nullableString,
  // Written before specs/0027 without it
  refuelId: z._default(nullableString, null),
  createdBy: z.string(),
})

const toExpense = (id: string, data: DocumentData): Expense | null => {
  const parsed = expenseSchema.safeParse(data)
  if (!parsed.success) {
    reportError(parsed.error, { operation: 'parseExpense', id })
    return null
  }
  const createdAt: unknown = data.createdAt
  return {
    id,
    ...parsed.data,
    takenAt: parsed.data.takenAt.toDate(),
    // Pending server timestamp on a local write
    createdAt: createdAt instanceof Timestamp ? createdAt.toDate() : null,
  }
}

export interface ExpensesPage {
  items: Expense[]
  truncated: boolean
}

/** The organization's expenses in the period, newest first. */
export const readExpensesInPeriod = async (
  orgId: string,
  start: Date,
  end: Date
): Promise<ExpensesPage> => {
  const { db } = await loadFirebase()
  const snapshot = await withTimeout(
    getDocs(
      query(
        collection(db, 'expenses'),
        where('orgId', '==', orgId),
        where('takenAt', '>=', Timestamp.fromDate(start)),
        where('takenAt', '<=', Timestamp.fromDate(end)),
        orderBy('takenAt', 'desc'),
        limit(MAX_EXPENSES_PER_PERIOD + 1)
      )
    ),
    'readExpenses'
  )
  return {
    items: snapshot.docs
      .slice(0, MAX_EXPENSES_PER_PERIOD)
      .map(document => toExpense(document.id, document.data()))
      .filter((expense): expense is Expense => expense !== null),
    truncated: snapshot.size > MAX_EXPENSES_PER_PERIOD,
  }
}

/** A trip's expenses (RF-13), oldest first. */
export const readTripExpenses = async (
  orgId: string,
  tripId: string
): Promise<Expense[]> => {
  const { db } = await loadFirebase()
  const snapshot = await withTimeout(
    getDocs(
      query(
        collection(db, 'expenses'),
        where('orgId', '==', orgId),
        where('tripId', '==', tripId)
      )
    ),
    'readTripExpenses'
  )
  return snapshot.docs
    .map(document => toExpense(document.id, document.data()))
    .filter((expense): expense is Expense => expense !== null)
    .sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime())
}

export const readExpense = async (id: string): Promise<Expense | null> => {
  const { db } = await loadFirebase()
  const snapshot = await withTimeout(
    getDoc(doc(db, 'expenses', id)),
    'readExpense'
  )
  const data = snapshot.data()
  return data ? toExpense(snapshot.id, data) : null
}

/** The document of a new expense, for a write or a batch. */
export const newExpenseData = (
  orgId: string,
  uid: string,
  fields: ExpenseFields
) => ({
  ...fields,
  takenAt: Timestamp.fromDate(fields.takenAt),
  orgId,
  // Only the backend writes a refuel's (specs/0027 RF-6)
  refuelId: null,
  createdAt: serverTimestamp(),
  createdBy: uid,
  updatedAt: serverTimestamp(),
  updatedBy: uid,
})

/** The changes of an edited expense, for a write or a batch. */
export const expenseChanges = (uid: string, fields: ExpenseFields) => ({
  ...fields,
  takenAt: Timestamp.fromDate(fields.takenAt),
  updatedAt: serverTimestamp(),
  updatedBy: uid,
})

/** Settles when the server accepts it; offline it waits in the queue. */
export const createExpense = async (
  id: string,
  orgId: string,
  fields: ExpenseFields
) => {
  const [{ db }, uid] = await Promise.all([loadFirebase(), currentUid()])
  await setDoc(doc(db, 'expenses', id), newExpenseData(orgId, uid, fields))
}

export const updateExpense = async (id: string, fields: ExpenseFields) => {
  const [{ db }, uid] = await Promise.all([loadFirebase(), currentUid()])
  await updateDoc(doc(db, 'expenses', id), expenseChanges(uid, fields))
}

/** A refuel's expense: only its link and description (specs/0027 RF-6). */
export const updateRefuelExpense = async (
  id: string,
  changes: RefuelExpenseChanges
) => {
  const [{ db }, uid] = await Promise.all([loadFirebase(), currentUid()])
  await updateDoc(doc(db, 'expenses', id), {
    ...changes,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
}

const refuelSchema = z.object({
  tankName: z.string(),
  equipment: z.object({
    kind: z.enum(['truck', 'trailer', 'none']),
    id: nullableString,
  }),
})

/** The refuel behind an expense (specs/0027 RF-9), or null if it is gone. */
export const readRefuelOfExpense = async (
  refuelId: string
): Promise<RefuelOfExpense | null> => {
  const { db } = await loadFirebase()
  const snapshot = await withTimeout(
    getDoc(doc(db, 'refuels', refuelId)),
    'readRefuelOfExpense'
  )
  const parsed = refuelSchema.safeParse(snapshot.data())
  if (!snapshot.exists() || !parsed.success) return null
  return parsed.data
}

export const deleteExpense = async (id: string) => {
  const { db } = await loadFirebase()
  await deleteDoc(doc(db, 'expenses', id))
}

export const receiptPathFor = (orgId: string, id: string) =>
  `orgs/${orgId}/expenses/${id}/receipt.jpg`

/**
 * Compresses and uploads the expense's receipt (it replaces the previous
 * one), then points the document at it. Needs a connection.
 */
export const uploadReceipt = async (
  orgId: string,
  id: string,
  file: Blob
): Promise<{ path: string; url: string }> => {
  const path = receiptPathFor(orgId, id)
  const [storage, { ref, uploadBytes, getDownloadURL }, compressed, uid] =
    await Promise.all([
      loadStorage(),
      import('firebase/storage'),
      compressImage(file),
      currentUid(),
    ])
  const receiptRef = ref(storage, path)
  await uploadBytes(receiptRef, compressed, { contentType: 'image/jpeg' })
  const url = await getDownloadURL(receiptRef)
  const { db } = await loadFirebase()
  await updateDoc(doc(db, 'expenses', id), {
    receiptPhotoPath: path,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })
  return { path, url }
}
