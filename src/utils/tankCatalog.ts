// The list of tanks to choose from, grouped and filtered (backend specs/0014
// RF-1–RF-5, specs/0015 RF-7). Pure: the catalog component draws the result.

import { formatNumber } from 'utils/formatNumber'

export type CatalogShape = 'cylinder' | 'd_flat_side' | 'rectangular'

export interface CatalogTank {
  /** Unique in the list: the template id or the stored tank's id. */
  key: string
  shape: CatalogShape
  /** A cylinder's diameter, or the height of a "D" or a box. */
  size: number
  /** The width of a "D" or a box; null for a cylinder. */
  width: number | null
  length: number
  /** Total gallons. */
  capacity: number
  /** Useable gallons, when the factory gives them apart. */
  usable?: number
  /** Truck brand, "Genérico", or none for a tank the user added. */
  brand?: string
  /** "Model (generation)" of the brand that ship it. */
  models?: readonly string[]
  /** A measure no source gave: to confirm with a tape (specs/0015 RF-3). */
  calculated?: boolean
  /** Added by the user (basic mode): marked "Tuyo". */
  own?: boolean
}

export const LENGTH_RANGES = [
  { id: 'short', label: 'Hasta 40', test: (inches: number) => inches <= 40 },
  {
    id: 'medium',
    label: '41–60',
    test: (inches: number) => inches > 40 && inches <= 60,
  },
  { id: 'long', label: 'Más de 60', test: (inches: number) => inches > 60 },
] as const
export type LengthRange = (typeof LENGTH_RANGES)[number]['id']

export interface CatalogFilters {
  brand: string | null
  model: string | null
  capacity: number | null
  /** A cylinder's diameter, or a "D"'s height (its round side's diameter). */
  diameter: number | null
  length: LengthRange | null
  /** What was typed, with the decimal already as a dot ("24.5"). */
  query: string
}

export const NO_FILTERS: CatalogFilters = {
  brand: null,
  model: null,
  capacity: null,
  diameter: null,
  length: null,
  query: '',
}

const distinct = (values: number[]) =>
  [...new Set(values)].sort((a, b) => a - b)

const roundSize = (tank: CatalogTank) =>
  tank.shape === 'rectangular' ? null : tank.size

const byName = (a: string, b: string) =>
  a.localeCompare(b, 'es', { numeric: true })

/** The chips of each row: only values some tank has (RF-3). */
export const filterOptions = (tanks: readonly CatalogTank[]) => ({
  brands: [
    ...new Set(tanks.flatMap(tank => (tank.brand ? [tank.brand] : []))),
  ].sort(byName),
  capacities: distinct(tanks.map(tank => tank.capacity)),
  diameters: distinct(
    tanks.flatMap(tank => {
      const size = roundSize(tank)
      return size === null ? [] : [size]
    })
  ),
  lengths: LENGTH_RANGES.filter(range =>
    tanks.some(tank => range.test(tank.length))
  ),
})

/** The models of one brand, for the row under it (specs/0015 RF-7). */
export const modelsOf = (tanks: readonly CatalogTank[], brand: string) =>
  [
    ...new Set(
      tanks
        .filter(tank => tank.brand === brand)
        .flatMap(tank => tank.models ?? [])
    ),
  ].sort(byName)

/**
 * "24" finds a 24 in any measure or the capacity (RF-4); "volvo" or "t680"
 * finds the brand or the model.
 */
const matchesQuery = (tank: CatalogTank, query: string) => {
  if (query === '') return true
  const numbers = [tank.capacity, tank.size, tank.width, tank.length]
  if (numbers.some(value => value !== null && String(value).includes(query)))
    return true
  const text = query.toLocaleLowerCase('es')
  return [tank.brand ?? '', ...(tank.models ?? [])].some(name =>
    name.toLocaleLowerCase('es').includes(text)
  )
}

export const filterTanks = (
  tanks: readonly CatalogTank[],
  filters: CatalogFilters
): CatalogTank[] => {
  const range = LENGTH_RANGES.find(item => item.id === filters.length)
  return tanks.filter(
    tank =>
      (filters.brand === null || tank.brand === filters.brand) &&
      (filters.model === null || (tank.models ?? []).includes(filters.model)) &&
      (filters.capacity === null || tank.capacity === filters.capacity) &&
      (filters.diameter === null || roundSize(tank) === filters.diameter) &&
      (range === undefined || range.test(tank.length)) &&
      matchesQuery(tank, filters.query)
  )
}

export const hasFilters = (filters: CatalogFilters) =>
  filters.brand !== null ||
  filters.model !== null ||
  filters.capacity !== null ||
  filters.diameter !== null ||
  filters.length !== null ||
  filters.query !== ''

export interface CapacityGroup {
  capacity: number
  tanks: CatalogTank[]
}

/** By capacity, smallest first; inside, by size and then length (RF-1). */
export const groupByCapacity = (
  tanks: readonly CatalogTank[]
): CapacityGroup[] => {
  const groups = new Map<number, CatalogTank[]>()
  for (const tank of tanks) {
    groups.set(tank.capacity, [...(groups.get(tank.capacity) ?? []), tank])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([capacity, list]) => ({
      capacity,
      tanks: list.sort((a, b) => a.size - b.size || a.length - b.length),
    }))
}

/** "Ø 26 × 60 pulg." or "En D · 19 × 25 × 57 pulg.". */
export const measuresText = (tank: CatalogTank) => {
  const length = formatNumber(tank.length)
  if (tank.width === null)
    return `Ø ${formatNumber(tank.size)} × ${length} pulg.`
  const kind = tank.shape === 'd_flat_side' ? 'En D' : 'Rectangular'
  return `${kind} · ${formatNumber(tank.size)} × ${formatNumber(tank.width)} × ${length} pulg.`
}

/** "Kenworth T680, T880 y 7 más", or the models alone within a brand. */
export const fitsText = (tank: CatalogTank, withBrand: boolean) => {
  const models = tank.models ?? []
  if (models.length === 0) return null
  const shown = models.slice(0, 2).join(', ')
  const rest = models.length - 2
  const list = rest > 0 ? `${shown} y ${String(rest)} más` : shown
  return withBrand && tank.brand ? `${tank.brand} ${list}` : list
}
