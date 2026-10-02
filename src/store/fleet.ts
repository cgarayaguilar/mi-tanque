import { create } from 'zustand'
import type { FleetTank, LastMeasurement, Trailer, Truck } from 'schemas/fleet'
import type { FleetCollection, OrgMember } from 'services/fleet'
import { useSessionStore } from 'store/session'
import { reportError } from 'utils/reportError'

// import(): the SDK stays out of the basic mode's bundle (specs/0000 RNF-1)
const fleetApi = () => import('services/fleet')

export type FleetStatus = 'idle' | 'loading' | 'ready' | 'error'

interface FleetItems {
  trucks: Truck[]
  trailers: Trailer[]
  tanks: FleetTank[]
}

interface FleetState extends FleetItems {
  orgId: string | null
  status: FleetStatus
  members: OrgMember[]
  /** Reads the active organization's fleet; shows what it has meanwhile. */
  load: (orgId: string) => Promise<void>
  /**
   * Applies a saved item at once (offline too) and returns the server write,
   * for the caller to report if the rules reject it later (ADR 0003).
   */
  save: (
    collection: FleetCollection,
    item: Truck | Trailer | FleetTank,
    write: () => Promise<void>
  ) => Promise<void>
  setArchived: (
    collection: FleetCollection,
    id: string,
    archived: boolean
  ) => Promise<void>
  setPhotoPath: (collection: FleetCollection, id: string, path: string) => void
  /**
   * A reading just saved here becomes the tank's last one at once: the
   * trigger updates the document later, and a refuel right after a
   * measurement took the old level as "before" (audit 2026-10-01 #14).
   */
  setLastReading: (tankId: string, reading: LastMeasurement) => void
  reset: () => void
}

const EMPTY: FleetItems & { members: OrgMember[] } = {
  trucks: [],
  trailers: [],
  tanks: [],
  members: [],
}

const byName = <T extends { name: string }>(items: T[]) =>
  [...items].sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { numeric: true })
  )

const upsert = <T extends { id: string; name: string }>(items: T[], item: T) =>
  byName([...items.filter(existing => existing.id !== item.id), item])

// Only the latest load writes: a slow read of the previous organization must
// not show its fleet in the new one
let latestLoad = 0

export const useFleetStore = create<FleetState>()((set, get) => ({
  ...EMPTY,
  orgId: null,
  status: 'idle',

  load: async orgId => {
    const request = ++latestLoad
    if (get().orgId !== orgId) set({ ...EMPTY, orgId, status: 'loading' })
    else if (get().status !== 'ready') set({ status: 'loading' })
    try {
      const api = await fleetApi()
      const [fleet, members] = await Promise.all([
        api.readFleet(orgId),
        api.readMembers(orgId),
      ])
      if (request !== latestLoad) return
      set({
        trucks: byName(fleet.trucks),
        trailers: byName(fleet.trailers),
        tanks: byName(fleet.tanks),
        members,
        status: 'ready',
      })
    } catch (error) {
      if (request !== latestLoad) return
      reportError(error, { operation: 'loadFleet' })
      set({ status: 'error' })
    }
  },

  save: async (collection, item, write) => {
    set(state => {
      switch (collection) {
        case 'trucks':
          return { trucks: upsert(state.trucks, item as Truck) }
        case 'trailers':
          return { trailers: upsert(state.trailers, item as Trailer) }
        case 'tanks':
          return { tanks: upsert(state.tanks, item as FleetTank) }
      }
    })
    await write()
  },

  setArchived: async (collection, id, archived) => {
    const patch = <T extends { id: string; archived: boolean }>(items: T[]) =>
      items.map(item => (item.id === id ? { ...item, archived } : item))
    set(state => ({
      trucks: collection === 'trucks' ? patch(state.trucks) : state.trucks,
      trailers:
        collection === 'trailers' ? patch(state.trailers) : state.trailers,
      tanks: collection === 'tanks' ? patch(state.tanks) : state.tanks,
    }))
    const api = await fleetApi()
    await api.updateFleetItem(collection, id, { archived })
  },

  setPhotoPath: (collection, id, path) => {
    const patch = <T extends { id: string; photoPath: string | null }>(
      items: T[]
    ) =>
      items.map(item => (item.id === id ? { ...item, photoPath: path } : item))
    set(state => ({
      trucks: collection === 'trucks' ? patch(state.trucks) : state.trucks,
      trailers:
        collection === 'trailers' ? patch(state.trailers) : state.trailers,
      tanks: collection === 'tanks' ? patch(state.tanks) : state.tanks,
    }))
  },

  setLastReading: (tankId, reading) => {
    set(state => ({
      tanks: state.tanks.map(tank =>
        tank.id === tankId &&
        (tank.lastMeasurement === null ||
          tank.lastMeasurement.takenAt <= reading.takenAt)
          ? { ...tank, lastMeasurement: reading }
          : tank
      ),
    }))
  },

  reset: () => {
    latestLoad++
    set({ ...EMPTY, orgId: null, status: 'idle' })
  },
}))

// Another organization or signing out: nothing of the previous fleet stays
// on screen (§2.4)
useSessionStore.subscribe((state, previous) => {
  if (state.organization?.id !== previous.organization?.id) {
    useFleetStore.getState().reset()
  }
})
