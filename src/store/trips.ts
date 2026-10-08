import { create } from 'zustand'
import { endOfMonth, startOfMonth } from 'date-fns'
import type { Trip } from 'schemas/trips'
import { useSessionStore } from 'store/session'
import type { Period } from 'types'
import { toWholeDays } from 'utils/period'
import { reportError } from 'utils/reportError'

// import(): the SDK stays out of the basic mode's bundle (specs/0025 RNF-1)
const api = () => import('services/trips')

export type TripsStatus = 'idle' | 'loading' | 'ready' | 'error'

/** This month, from its first day to its last (specs/0025 RF-6). */
export const currentMonth = (now = new Date()): Period => ({
  start: startOfMonth(now),
  end: endOfMonth(now),
})

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
      const inPeriod = trip.startAt >= start && trip.startAt <= end
      set(state => ({
        items: newestFirst([
          ...state.items.filter(item => item.id !== trip.id),
          ...(inPeriod ? [trip] : []),
        ]),
        known: { ...state.known, [trip.id]: trip },
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

    reset: () => {
      latestRequest++
      set({
        orgId: null,
        chosenPeriod: null,
        items: [],
        truncated: false,
        status: 'idle',
        known: {},
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
