import { PREDEFINED_TANKS } from 'services/tanks'
import { formatNumber } from 'utils/formatNumber'

/**
 * The basic mode's 15 predefined tanks as templates for the fleet (backend
 * specs/0003 RF-9). Bundled, not in Firestore: no reads, works offline.
 */
export interface TankTemplate {
  id: string
  label: string
  capacityGal: number
  diameterIn: number
  lengthIn: number
}

export const TANK_TEMPLATES: readonly TankTemplate[] = PREDEFINED_TANKS.map(
  ({ capacity, diameter, length }) => ({
    id: `cyl-${String(capacity)}-${String(diameter)}x${String(length)}`,
    label: `${formatNumber(capacity)} gal · ${formatNumber(diameter)} × ${formatNumber(length)} pulg.`,
    capacityGal: capacity,
    diameterIn: diameter,
    lengthIn: length,
  })
)
