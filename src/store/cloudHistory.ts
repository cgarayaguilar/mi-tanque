import { create } from 'zustand'
import type { QueryDocumentSnapshot } from 'firebase/firestore'
import type {
  CloudMeasurement,
  MeasurementEdit,
} from 'services/cloudMeasurements'
import { defaultPeriod, toWholeDays } from 'utils/period'
import { useSessionStore } from 'store/session'
import type { Period } from 'types'
import { reportError } from 'utils/reportError'

// import(): the SDK stays out of the basic mode's bundle (specs/0000 RNF-1)
const api = () => import('services/cloudMeasurements')

export type CloudHistoryStatus = 'idle' | 'loading' | 'ready' | 'error'

interface CloudHistoryState {
  orgId: string | null
  /** null until chosen: the last week through today (like the basic mode). */
  chosenPeriod: Period | null
  equipmentId: string | null
  items: CloudMeasurement[]
  cursor: QueryDocumentSnapshot | null
  status: CloudHistoryStatus
  loadingMore: boolean
  load: (orgId: string) => Promise<void>
  loadMore: () => Promise<void>
  choosePeriod: (period: Period) => Promise<void>
  chooseEquipment: (equipmentId: string | null) => Promise<void>
  /** Shows an edit at once; the write is the caller's (offline, ADR 0003). */
  applyEdit: (id: string, edit: MeasurementEdit) => void
  remove: (id: string) => void
  reset: () => void
}

export const periodOf = (
  state: Pick<CloudHistoryState, 'chosenPeriod'>
): Period => state.chosenPeriod ?? defaultPeriod()

const EMPTY = {
  items: [] as CloudMeasurement[],
  cursor: null,
  loadingMore: false,
}

// Only the latest request writes: a slow page of the previous filter must not
// replace the current one
let latestRequest = 0

export const useCloudHistoryStore = create<CloudHistoryState>()((set, get) => {
  const fetchFirstPage = async () => {
    const { orgId, equipmentId } = get()
    if (!orgId) return
    const request = ++latestRequest
    if (get().status !== 'ready') set({ status: 'loading' })
    try {
      const { start, end } = periodOf(get())
      const page = await (
        await api()
      ).readHistoryPage({
        orgId,
        start,
        end,
        equipmentId,
        after: null,
      })
      if (request !== latestRequest) return
      set({ items: page.items, cursor: page.cursor, status: 'ready' })
    } catch (error) {
      if (request !== latestRequest) return
      reportError(error, { operation: 'loadCloudHistory' })
      set({ status: 'error' })
    }
  }

  return {
    orgId: null,
    chosenPeriod: null,
    equipmentId: null,
    status: 'idle',
    ...EMPTY,

    load: orgId => {
      if (get().orgId !== orgId) {
        set({
          orgId,
          chosenPeriod: null,
          equipmentId: null,
          ...EMPTY,
          status: 'loading',
        })
      }
      return fetchFirstPage()
    },

    loadMore: async () => {
      const { orgId, cursor, equipmentId, loadingMore } = get()
      if (!orgId || !cursor || loadingMore) return
      const request = latestRequest
      set({ loadingMore: true })
      try {
        const { start, end } = periodOf(get())
        const page = await (
          await api()
        ).readHistoryPage({
          orgId,
          start,
          end,
          equipmentId,
          after: cursor,
        })
        if (request !== latestRequest) return
        set(state => ({
          items: [...state.items, ...page.items],
          cursor: page.cursor,
        }))
      } catch (error) {
        reportError(error, { operation: 'loadMoreCloudHistory' })
        throw error
      } finally {
        set({ loadingMore: false })
      }
    },

    choosePeriod: period => {
      set({ chosenPeriod: toWholeDays(period), ...EMPTY, status: 'loading' })
      return fetchFirstPage()
    },

    chooseEquipment: equipmentId => {
      set({ equipmentId, ...EMPTY, status: 'loading' })
      return fetchFirstPage()
    },

    applyEdit: (id, { reading, ...rest }) => {
      set(state => ({
        items: state.items.map(item =>
          item.id === id ? { ...item, ...rest, ...reading } : item
        ),
      }))
    },

    remove: id => {
      set(state => ({ items: state.items.filter(item => item.id !== id) }))
    },

    reset: () => {
      latestRequest++
      set({
        orgId: null,
        chosenPeriod: null,
        equipmentId: null,
        status: 'idle',
        ...EMPTY,
      })
    },
  }
})

// Another organization or signing out: nothing of the previous history stays
useSessionStore.subscribe((state, previous) => {
  if (state.organization?.id !== previous.organization?.id) {
    useCloudHistoryStore.getState().reset()
  }
})
