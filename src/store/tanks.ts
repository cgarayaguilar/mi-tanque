import { create } from 'zustand'
import {
  createTank,
  readTanks,
  saveCatalogTank,
  seedPredefinedTanks,
} from 'services/tanks'
import type { Tank, TankDimensions } from 'types'
import { reportError } from 'utils/reportError'

export type TanksStatus = 'idle' | 'loading' | 'ready' | 'error'

interface TanksState {
  tanks: Tank[]
  status: TanksStatus
  /** Seeds the predefined tanks on the first visit, then reads them all. */
  load: () => Promise<void>
  /** Saves a tank and adds it to the list. Rejects like `createTank`. */
  addTank: (dimensions: TankDimensions) => Promise<Tank>
  /** A catalog tank as one of this phone's tanks (specs/0015, 0019). */
  addCatalogTank: (
    catalogId: string,
    dimensions: TankDimensions
  ) => Promise<Tank>
}

/** The diameter, or the height of a box or a "D" (specs/0019). */
const across = (tank: Tank) =>
  tank.shape === 'cylinder' ? tank.diameter : tank.height

const bySize = (a: Tank, b: Tank) =>
  a.capacity - b.capacity || across(a) - across(b) || a.length - b.length

// One read at a time: StrictMode and quick revisits call load() back to back
let pendingLoad: Promise<void> | null = null

export const useTanksStore = create<TanksState>()((set, get) => ({
  tanks: [],
  status: 'idle',

  load: () => {
    pendingLoad ??= (async () => {
      // Cache first: tanks already shown stay visible while they refresh
      if (get().status !== 'ready') set({ status: 'loading' })
      try {
        await seedPredefinedTanks()
        const tanks = await readTanks()
        set({ tanks: tanks.sort(bySize), status: 'ready' })
      } catch (error) {
        reportError(error, { operation: 'loadTanks' })
        set({ status: 'error' })
      } finally {
        pendingLoad = null
      }
    })()
    return pendingLoad
  },

  addTank: async dimensions => {
    const tank = await createTank(dimensions)
    set(state => ({ tanks: [...state.tanks, tank].sort(bySize) }))
    return tank
  },

  addCatalogTank: async (catalogId, dimensions) => {
    const tank = await saveCatalogTank(catalogId, dimensions)
    set(state => ({
      tanks: [...state.tanks.filter(item => item.id !== tank.id), tank].sort(
        bySize
      ),
    }))
    return tank
  },
}))
