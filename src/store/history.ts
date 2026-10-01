import { create } from 'zustand'
import { endOfDay, startOfDay, subDays } from 'date-fns'
import { readMeasurementsInPeriod } from 'services/measurements'
import { readTanks } from 'services/tanks'
import type { Period } from 'types'
import { groupByTank, type TankHistory } from 'utils/measurementHistory'
import { reportError } from 'utils/reportError'

export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'error'

/** The last week, through the end of today. */
export const defaultPeriod = (now = new Date()): Period => ({
  start: startOfDay(subDays(now, 7)),
  end: endOfDay(now),
})

/** Whole days, so the last day includes its final hours. */
export const toWholeDays = ({ start, end }: Period): Period => ({
  start: startOfDay(start),
  end: endOfDay(end),
})

interface HistoryState {
  /** null until the user picks one: the default week then follows today. */
  chosenPeriod: Period | null
  status: HistoryStatus
  histories: TankHistory[]
  /** Reads the period again; tanks already shown stay while it refreshes. */
  load: () => Promise<void>
  choosePeriod: (period: Period) => Promise<void>
}

const selectPeriod = (state: HistoryState): Period =>
  state.chosenPeriod ?? defaultPeriod()

// Only the latest request may write: an older, slower one would show the
// wrong period after a quick change
let latestRequest = 0

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  chosenPeriod: null,
  status: 'idle',
  histories: [],

  load: async () => {
    const request = ++latestRequest
    if (get().status !== 'ready') set({ status: 'loading' })
    try {
      const [measurements, tanks] = await Promise.all([
        readMeasurementsInPeriod(selectPeriod(get())),
        readTanks(),
      ])
      if (request !== latestRequest) return
      set({ histories: groupByTank(measurements, tanks), status: 'ready' })
    } catch (error) {
      if (request !== latestRequest) return
      reportError(error, { operation: 'loadHistory' })
      set({ status: 'error' })
    }
  },

  choosePeriod: period => {
    // Another period: its data is not the one on screen
    set({ chosenPeriod: toWholeDays(period), status: 'loading', histories: [] })
    return get().load()
  },
}))
