import { create } from 'zustand'
import {
  presetCategoriesOf,
  sortCategories,
  type ExpenseCategory,
} from 'schemas/expenseCategories'
import type { Expense } from 'schemas/expenses'
import { selectActiveRole, useSessionStore } from 'store/session'
import { currentMonth } from 'store/trips'
import type { Period } from 'types'
import { toWholeDays } from 'utils/period'
import { reportError } from 'utils/reportError'
import { canWriteFleet } from 'utils/roles'

// import(): the SDK stays out of the basic mode's bundle (specs/0026 RNF-1).
// One promise: Gastos reads the period and the categories in the same tick,
// and in Vitest a second import() started then can get the real module
const load = () => import('services/expenses')
let loading: ReturnType<typeof load> | null = null
const api = () => (loading ??= load())

export type ExpensesStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ExpensesState {
  orgId: string | null
  categories: ExpenseCategory[]
  categoriesStatus: ExpensesStatus
  /** null until chosen: the current month. */
  chosenPeriod: Period | null
  items: Expense[]
  truncated: boolean
  status: ExpensesStatus
  /** Every expense seen or saved here, by id: its screen finds it at once. */
  known: Record<string, Expense>
  /** Reads the categories; an organization with none gets the presets. */
  loadCategories: (orgId: string) => Promise<void>
  load: (orgId: string) => Promise<void>
  choosePeriod: (period: Period) => Promise<void>
  remember: (expenses: Expense[]) => void
  /**
   * A trip's expenses as just read: the ones that left it (moved or deleted
   * elsewhere, or by the backend) go too (audit 0027).
   */
  replaceTripExpenses: (tripId: string, expenses: Expense[]) => void
  /** Shows a saved expense at once; the write is the caller's (ADR 0003). */
  save: (expense: Expense, write: () => Promise<void>) => Promise<void>
  remove: (id: string, write: () => Promise<void>) => Promise<void>
  /** A trip's expenses as saved with it (RF-12): the write is the trip's. */
  applyTripExpenses: (saved: Expense[], removed: string[]) => void
  /** A category added or changed here, at once. */
  saveCategory: (
    category: ExpenseCategory,
    write: () => Promise<void>
  ) => Promise<void>
  reset: () => void
}

export const expensesPeriodOf = (
  state: Pick<ExpensesState, 'chosenPeriod'>
): Period => state.chosenPeriod ?? currentMonth()

const newestFirst = (expenses: Expense[]) =>
  [...expenses].sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())

const EMPTY = {
  orgId: null,
  categories: [],
  categoriesStatus: 'idle' as const,
  chosenPeriod: null,
  items: [],
  truncated: false,
  status: 'idle' as const,
  known: {},
}

// Only the latest read writes (another period or organization)
let latestRequest = 0
let latestCategories = 0
// One read of the categories at a time: two at once would both find none
// and seed twice, and the second batch is an update the rules reject
let categoriesInFlight: { orgId: string; done: Promise<void> } | null = null

export const useExpensesStore = create<ExpensesState>()((set, get) => {
  const fetchPeriod = async () => {
    const { orgId } = get()
    if (!orgId) return
    const request = ++latestRequest
    if (get().status !== 'ready') set({ status: 'loading' })
    try {
      const { start, end } = expensesPeriodOf(get())
      const page = await (await api()).readExpensesInPeriod(orgId, start, end)
      if (request !== latestRequest) return
      set(state => ({
        items: page.items,
        truncated: page.truncated,
        status: 'ready',
        known: {
          ...state.known,
          ...Object.fromEntries(page.items.map(item => [item.id, item])),
        },
      }))
    } catch (error) {
      if (request !== latestRequest) return
      reportError(error, { operation: 'loadExpenses' })
      set({ status: 'error' })
    }
  }

  const sameOrg = (orgId: string) => {
    if (get().orgId !== orgId) set({ ...EMPTY, orgId })
  }

  const readCategories = async (orgId: string) => {
    sameOrg(orgId)
    const request = ++latestCategories
    if (get().categoriesStatus !== 'ready') set({ categoriesStatus: 'loading' })
    try {
      const services = await api()
      let categories = await services.readCategories(orgId)
      // First time in Gastos: the presets (RF-1). A viewer cannot write
      // them: they see the presets until someone who can opens Gastos
      if (categories.length === 0) {
        categories = canWriteFleet(selectActiveRole(useSessionStore.getState()))
          ? await services.seedCategories(orgId)
          : presetCategoriesOf(orgId)
      }
      if (request !== latestCategories) return
      set({
        categories: sortCategories(categories),
        categoriesStatus: 'ready',
      })
    } catch (error) {
      if (request !== latestCategories) return
      // Offline the first time: not a fault, the retry hint covers it
      if (
        !(error instanceof Error) ||
        error.message !== 'expense-categories-not-read'
      ) {
        reportError(error, { operation: 'loadExpenseCategories' })
      }
      set({ categoriesStatus: 'error' })
    }
  }

  return {
    ...EMPTY,

    loadCategories: orgId => {
      if (categoriesInFlight?.orgId === orgId) return categoriesInFlight.done
      const done = readCategories(orgId).finally(() => {
        if (categoriesInFlight?.done === done) categoriesInFlight = null
      })
      categoriesInFlight = { orgId, done }
      return done
    },

    load: async orgId => {
      sameOrg(orgId)
      await fetchPeriod()
    },

    choosePeriod: async period => {
      set({
        chosenPeriod: toWholeDays(period),
        items: [],
        truncated: false,
        status: 'idle',
      })
      await fetchPeriod()
    },

    replaceTripExpenses: (tripId, expenses) => {
      const read = new Set(expenses.map(item => item.id))
      const gone = (item: Expense) =>
        item.tripId === tripId && !read.has(item.id)
      set(state => ({
        items: state.items.filter(item => !gone(item)),
        known: {
          ...Object.fromEntries(
            Object.entries(state.known).filter(([, item]) => !gone(item))
          ),
          ...Object.fromEntries(expenses.map(item => [item.id, item])),
        },
      }))
    },

    remember: expenses => {
      set(state => ({
        known: {
          ...state.known,
          ...Object.fromEntries(expenses.map(item => [item.id, item])),
        },
      }))
    },

    save: async (expense, write) => {
      const { start, end } = expensesPeriodOf(get())
      const inPeriod = expense.takenAt >= start && expense.takenAt <= end
      set(state => ({
        items: newestFirst([
          ...state.items.filter(item => item.id !== expense.id),
          ...(inPeriod ? [expense] : []),
        ]),
        known: { ...state.known, [expense.id]: expense },
      }))
      await write()
    },

    remove: async (id, write) => {
      set(state => {
        const { [id]: _, ...known } = state.known
        return { items: state.items.filter(item => item.id !== id), known }
      })
      await write()
    },

    applyTripExpenses: (saved, removed) => {
      const { start, end } = expensesPeriodOf(get())
      const changed = new Set([...removed, ...saved.map(item => item.id)])
      set(state => {
        const gone = new Set(removed)
        return {
          known: {
            ...Object.fromEntries(
              Object.entries(state.known).filter(([id]) => !gone.has(id))
            ),
            ...Object.fromEntries(saved.map(item => [item.id, item])),
          },
          items: newestFirst([
            ...state.items.filter(item => !changed.has(item.id)),
            ...saved.filter(
              expense => expense.takenAt >= start && expense.takenAt <= end
            ),
          ]),
        }
      })
    },

    saveCategory: async (category, write) => {
      set(state => ({
        categories: sortCategories([
          ...state.categories.filter(item => item.id !== category.id),
          category,
        ]),
      }))
      await write()
    },

    reset: () => {
      latestRequest++
      latestCategories++
      categoriesInFlight = null
      set(EMPTY)
    },
  }
})

// Another organization or signing out: nothing of the previous one stays
useSessionStore.subscribe((state, previous) => {
  if (state.organization?.id !== previous.organization?.id) {
    useExpensesStore.getState().reset()
  }
})
