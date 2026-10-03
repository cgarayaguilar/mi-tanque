import type { CatalogShape, TruckTank } from 'data/buildTruckTanks'
import truckTanks from 'data/truckTanks.json'
import { PREDEFINED_TANKS } from 'services/tanks'
import type { CatalogTank } from 'utils/tankCatalog'

/**
 * The tanks to start from (backend specs/0003 RF-9, specs/0015): the 15
 * "Genérico" tanks of the basic mode and the factory tanks of each truck
 * brand. Bundled, not in Firestore: no reads, works offline.
 */
export interface TankTemplate {
  id: string
  brand: string
  /** "Model (generation)" that ship it; none for a "Genérico". */
  models: readonly string[]
  shape: CatalogShape
  dimensions: TruckTank['dimensions']
  capacityGal: number
  usableGal?: number
  /** A length or width no source gave (specs/0015 RF-3). */
  calculated: boolean
  /** From a factory or parts source: measured with the capacity (RF-9). */
  sourced: boolean
}

export const GENERIC_BRAND = 'Genérico'

// The ids of the 15 stay as they were: fleet tanks already point to them
const GENERIC_TEMPLATES: TankTemplate[] = PREDEFINED_TANKS.map(
  ({ capacity, diameter, length }) => ({
    id: `cyl-${String(capacity)}-${String(diameter)}x${String(length)}`,
    brand: GENERIC_BRAND,
    models: [],
    shape: 'cylinder',
    dimensions: { diameterIn: diameter, lengthIn: length },
    capacityGal: capacity,
    calculated: false,
    sourced: false,
  })
)

// Built and checked by scripts/build-truck-tanks.mjs: a test keeps the file
// equal to what the script makes of the research (specs/0015 RNF-3)
const TRUCK_TEMPLATES: TankTemplate[] = (
  truckTanks as unknown as TruckTank[]
).map(tank => ({
  id: tank.id,
  brand: tank.brand,
  models: tank.models,
  shape: tank.shape,
  dimensions: tank.dimensions,
  capacityGal: tank.capacityGal,
  ...(tank.usableGal === undefined ? {} : { usableGal: tank.usableGal }),
  calculated: (tank.calculated ?? []).length > 0,
  sourced: true,
}))

export const TANK_TEMPLATES: readonly TankTemplate[] = [
  ...GENERIC_TEMPLATES,
  ...TRUCK_TEMPLATES,
]

const BY_ID = new Map(TANK_TEMPLATES.map(template => [template.id, template]))

export const templateById = (id: string | null | undefined) =>
  id ? BY_ID.get(id) : undefined

/** The cross-section's sizes: diameter, or height and width. */
export const templateSize = (template: TankTemplate) =>
  'diameterIn' in template.dimensions
    ? { size: template.dimensions.diameterIn, width: null }
    : {
        size: template.dimensions.heightIn,
        width: template.dimensions.widthIn,
      }

export const toCatalogTank = (template: TankTemplate): CatalogTank => ({
  key: template.id,
  shape: template.shape,
  ...templateSize(template),
  length: template.dimensions.lengthIn,
  capacity: template.capacityGal,
  ...(template.usableGal === undefined ? {} : { usable: template.usableGal }),
  brand: template.brand,
  models: template.models,
  calculated: template.calculated,
})

/** Whether the tank comes from a factory source (backend specs/0015 RF-9). */
export const isFactoryTemplate = (templateId: string | null | undefined) =>
  templateById(templateId)?.sourced === true
