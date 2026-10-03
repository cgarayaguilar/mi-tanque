import { create } from 'zustand'
import * as z from 'zod/mini'
import { sileo } from 'sileo'
import { readTankDimensions } from 'schemas/tank'
import type { Tank } from 'types'
import { reportError } from 'utils/reportError'

// Same key and raw-JSON format the legacy useLocalStorage hook used, so the
// tank users already selected survives the migration
const STORAGE_KEY = 'defaultTank'

// Older builds stored dimensions as strings, no shape (a lying cylinder,
// specs/0019 RF-2), and {} when nothing was selected
const storedTankSchema = z.object({
  id: z.number(),
  catalogId: z.optional(z.string()),
})

const readStoredTank = (): Tank | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null

    const json: unknown = JSON.parse(raw)
    const parsed = storedTankSchema.safeParse(json)
    const dimensions = readTankDimensions(json)
    if (!parsed.success || dimensions === null) return null
    const { id, catalogId } = parsed.data
    return {
      id,
      ...dimensions,
      ...(catalogId === undefined ? {} : { catalogId }),
    }
  } catch (error) {
    // No toast: starting without a selected tank is a valid state
    reportError(error, { operation: 'readSelectedTank' })
    return null
  }
}

interface SelectedTankState {
  selectedTank: Tank | null
  selectTank: (tank: Tank) => void
  /** Re-reads the stored selection (another tab, or tests). */
  rehydrate: () => void
}

export const useSelectedTankStore = create<SelectedTankState>()(set => ({
  selectedTank: readStoredTank(),

  selectTank: tank => {
    // Applied for the session even if it cannot be persisted
    set({ selectedTank: tank })

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tank))
    } catch (error) {
      reportError(error, { operation: 'writeSelectedTank', tankId: tank.id })
      sileo.error({
        title: 'No pudimos recordar tu elección',
        description: 'Seguirá activa hasta que cierres la app.',
      })
    }
  },

  rehydrate: () => {
    set({ selectedTank: readStoredTank() })
  },
}))
