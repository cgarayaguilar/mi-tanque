import { create } from 'zustand'
import { endOfMonth, startOfMonth } from 'date-fns'
import type { Trip } from 'schemas/trips'
import { useSessionStore } from 'store/session'
import type { Period } from 'types'
import { toWholeDays } from 'utils/period'
import { reportError } from 'utils/reportError'
import {
  DEFAULT_TRIP_ORDER,
  NO_TRIP_FILTERS,
  type TripFilters,
  type TripGrouping,
  type TripOrder,
} from 'utils/tripGroups'

// import(): the SDK stays out of the basic mode's bundle (specs/0025 RNF-1)
const api = () => import('services/trips')

export type TripsStatus = 'idle' | 'loading' | 'ready' | 'error'

/** This month, from its first day to its last (specs/0025 RF-6). */
export const currentMonth = (now = new Date()): Period => ({
  start: startOfMonth(now),
  end: endOfMonth(now),
})

/** How the list shows its trips (specs/0030). */
export interface TripsView {
  filters: TripFilters
  /** null: not grouped. */
  grouping: TripGrouping | null
  order: TripOrder
}

const DEFAULT_VIEW: TripsView = {
  filters: NO_TRIP_FILTERS,
  grouping: null,
  order: DEFAULT_TRIP_ORDER,
}

interface TripsState {
  orgId: string | null
  /** null until chosen: the current month. */
  chosenPeriod: Period | null
  items: Trip[]
  /** More trips than read started in the period (RF-7). */
  truncated: boolean
  status: TripsStatus
  /** Every trip seen or saved here, by id: a trip's screen finds it at once. */
  known: Record<string, Trip>
  /** Kept while the app is open: back from a trip, the list is as it was (RF-8). */
  view: TripsView
  setFilters: (filters: Partial<TripFilters>) => void
  setGrouping: (grouping: TripGrouping | null) => void
  setOrder: (order: TripOrder) => void
  /** A trip read on its own (its screen, outside the period shown). */
  remember: (trip: Trip) => void
  load: (orgId: string) => Promise<void>
  choosePeriod: (period: Period) => Promise<void>
  /**
   * Shows a saved trip at once (offline too) and returns the server write,
   * for the caller to report if the rules reject it later (ADR 0003).
   */
  save: (trip: Trip, write: () => Promise<void>) => Promise<void>
  remove: (id: string, write: () => Promise<void>) => Promise<void>
  reset: () => void
}

export const tripsPeriodOf = (
  state: Pick<TripsState, 'chosenPeriod'>
): Period => state.chosenPeriod ?? currentMonth()

const newestFirst = (trips: Trip[]) =>
  [...trips].sort((a, b) => b.startAt.getTime() - a.startAt.getTime())

// Only the latest read writes: a slow one of another period or organization
// must not replace it
let latestRequest = 0

export const useTripsStore = create<TripsState>()((set, get) => {
  const fetchPeriod = async () => {
    const { orgId } = get()
    if (!orgId) return
    const request = ++latestRequest
    if (get().status !== 'ready') set({ status: 'loading' })
    try {
      const { start, end } = tripsPeriodOf(get())
      const page = await (await api()).readTripsInPeriod(orgId, start, end)
      if (request !== latestRequest) return
      set(state => ({
        items: page.items,
        truncated: page.truncated,
        status: 'ready',
        known: {
          ...state.known,
          ...Object.fromEntries(page.items.map(trip => [trip.id, trip])),
        },
      }))
    } catch (error) {
      if (request !== latestRequest) return
      reportError(error, { operation: 'loadTrips' })
      set({ status: 'error' })
    }
  }

  return {
    orgId: null,
    chosenPeriod: null,
    items: [],
    truncated: false,
    status: 'idle',
    known: {},
    view: DEFAULT_VIEW,

    setFilters: filters => {
      set(state => ({
        view: { ...state.view, filters: { ...state.view.filters, ...filters } },
      }))
    },
    setGrouping: grouping => {
      set(state => ({ view: { ...state.view, grouping } }))
    },
    setOrder: order => {
      set(state => ({ view: { ...state.view, order } }))
    },

    remember: trip => {
      set(state => ({ known: { ...state.known, [trip.id]: trip } }))
    },

    load: async orgId => {
      if (get().orgId !== orgId) {
        set({ orgId, items: [], truncated: false, status: 'idle' })
      }
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

    save: async (trip, write) => {
      const { start, end } = tripsPeriodOf(get())
      const inPeriod = (item: { startAt: Date }) =>
        item.startAt >= start && item.startAt <= end
      const before = get().known[trip.id]
      const listed = get().items.find(item => item.id === trip.id)
      set(state => ({
        items: newestFirst([
          ...state.items.filter(item => item.id !== trip.id),
          ...(inPeriod(trip) ? [trip] : []),
        ]),
        known: { ...state.known, [trip.id]: trip },
      }))
      try {
        await write()
      } catch (error) {
        // Refused (rules, permissions): it is shown as it was, not as a
        // trip that was never saved (audit 2026-10-09)
        set(state => {
          if (state.known[trip.id] !== trip) return {}
          const { [trip.id]: _, ...known } = state.known
          return {
            items: newestFirst([
              ...state.items.filter(item => item.id !== trip.id),
              ...(listed ? [listed] : []),
            ]),
            known: before ? { ...known, [trip.id]: before } : known,
          }
        })
        throw error
      }
    },

    remove: async (id, write) => {
      set(state => {
        const { [id]: _, ...known } = state.known
        return { items: state.items.filter(item => item.id !== id), known }
      })
      await write()
    },

    reset: () => {
      latestRequest++
      set({
        orgId: null,
        chosenPeriod: null,
        items: [],
        truncated: false,
        status: 'idle',
        known: {},
        view: DEFAULT_VIEW,
      })
    },
  }
})

// Another organization or signing out: nothing of the previous one stays
useSessionStore.subscribe((state, previous) => {
  if (state.organization?.id !== previous.organization?.id) {
    useTripsStore.getState().reset()
  }
})
