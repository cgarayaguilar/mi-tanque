import { create } from 'zustand'
import type { QueryDocumentSnapshot } from 'firebase/firestore'
import type { CloudRefuel, RefuelEdit } from 'services/cloudRefuels'
import { useSessionStore } from 'store/session'
import type { Period } from 'types'
import { reportError } from 'utils/reportError'

// import(): the SDK stays out of the basic mode's bundle (specs/0000 RNF-1)
const api = () => import('services/cloudRefuels')

export interface RefuelsQuery {
  orgId: string
  period: Period
  equipmentId: string | null
}

interface CloudRefuelsState {
  key: string | null
  query: RefuelsQuery | null
  items: CloudRefuel[]
  cursor: QueryDocumentSnapshot | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  loadingMore: boolean
  /** Same period and equipment as the measurements (backend specs/0006 RF-7). */
  load: (query: RefuelsQuery, options?: { force?: boolean }) => Promise<void>
  loadMore: () => Promise<void>
  /** Shows an edit at once; the write is the caller's (offline, ADR 0003). */
  applyEdit: (id: string, edit: RefuelEdit) => void
  remove: (id: string) => void
  reset: () => void
}

const keyOf = ({ orgId, period, equipmentId }: RefuelsQuery) =>
  [
    orgId,
    String(period.start.getTime()),
    String(period.end.getTime()),
    equipmentId ?? '',
  ].join('|')

const EMPTY = { items: [] as CloudRefuel[], cursor: null, loadingMore: false }

// Only the latest request writes (a slow page of a previous filter is dropped)
let latestRequest = 0

export const useCloudRefuelsStore = create<CloudRefuelsState>()((set, get) => ({
  key: null,
  query: null,
  status: 'idle',
  ...EMPTY,

  load: async (query, { force = false } = {}) => {
    const key = keyOf(query)
    if (!force && get().key === key && get().status !== 'error') return
    const request = ++latestRequest
    set(
      get().key === key
        ? { status: get().status === 'ready' ? 'ready' : 'loading' }
        : { key, query, ...EMPTY, status: 'loading' }
    )
    try {
      const page = await (
        await api()
      ).readRefuelsPage({
        orgId: query.orgId,
        start: query.period.start,
        end: query.period.end,
        equipmentId: query.equipmentId,
        after: null,
      })
      if (request !== latestRequest) return
      set({ items: page.items, cursor: page.cursor, status: 'ready' })
    } catch (error) {
      if (request !== latestRequest) return
      reportError(error, { operation: 'loadCloudRefuels' })
      set({ status: 'error' })
    }
  },

  loadMore: async () => {
    const { query, cursor, loadingMore } = get()
    if (!query || !cursor || loadingMore) return
    const request = latestRequest
    set({ loadingMore: true })
    try {
      const page = await (
        await api()
      ).readRefuelsPage({
        orgId: query.orgId,
        start: query.period.start,
        end: query.period.end,
        equipmentId: query.equipmentId,
        after: cursor,
      })
      if (request !== latestRequest) return
      set(state => ({
        items: [...state.items, ...page.items],
        cursor: page.cursor,
      }))
    } catch (error) {
      reportError(error, { operation: 'loadMoreCloudRefuels' })
      throw error
    } finally {
      set({ loadingMore: false })
    }
  },

  applyEdit: (id, { values, totals, odometerKm }) => {
    set(state => ({
      items: state.items.map(item =>
        item.id === id ? { ...item, ...values, ...totals, odometerKm } : item
      ),
    }))
  },

  remove: id => {
    set(state => ({ items: state.items.filter(item => item.id !== id) }))
  },

  reset: () => {
    latestRequest++
    set({ key: null, query: null, status: 'idle', ...EMPTY })
  },
}))

// Another organization or signing out: nothing of the previous one stays
useSessionStore.subscribe((state, previous) => {
  if (state.organization?.id !== previous.organization?.id) {
    useCloudRefuelsStore.getState().reset()
  }
})
