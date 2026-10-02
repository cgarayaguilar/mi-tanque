// The list of tanks to choose from, grouped and filtered (backend specs/0014
// RF-1–RF-5). Pure: the catalog component only draws the result.

export interface CatalogTank {
  /** Unique in the list: the template id or the stored tank's id. */
  key: string
  capacity: number
  diameter: number
  length: number
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
  capacity: number | null
  diameter: number | null
  length: LengthRange | null
  /** What was typed, with the decimal already as a dot ("24.5"). */
  query: string
}

export const NO_FILTERS: CatalogFilters = {
  capacity: null,
  diameter: null,
  length: null,
  query: '',
}

const distinct = (values: number[]) =>
  [...new Set(values)].sort((a, b) => a - b)

/** The chips of each row: only values some tank has (RF-3). */
export const filterOptions = (tanks: readonly CatalogTank[]) => ({
  capacities: distinct(tanks.map(tank => tank.capacity)),
  diameters: distinct(tanks.map(tank => tank.diameter)),
  lengths: LENGTH_RANGES.filter(range =>
    tanks.some(tank => range.test(tank.length))
  ),
})

/** "24" finds a 24 in the capacity, the diameter or the length (RF-4). */
const matchesQuery = (tank: CatalogTank, query: string) =>
  query === '' ||
  [tank.capacity, tank.diameter, tank.length].some(value =>
    String(value).includes(query)
  )

export const filterTanks = (
  tanks: readonly CatalogTank[],
  filters: CatalogFilters
): CatalogTank[] => {
  const range = LENGTH_RANGES.find(item => item.id === filters.length)
  return tanks.filter(
    tank =>
      (filters.capacity === null || tank.capacity === filters.capacity) &&
      (filters.diameter === null || tank.diameter === filters.diameter) &&
      (range === undefined || range.test(tank.length)) &&
      matchesQuery(tank, filters.query)
  )
}

export const hasFilters = (filters: CatalogFilters) =>
  filters.capacity !== null ||
  filters.diameter !== null ||
  filters.length !== null ||
  filters.query !== ''

export interface CapacityGroup {
  capacity: number
  tanks: CatalogTank[]
}

/** By capacity, smallest first; inside, by diameter and then length (RF-1). */
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
      tanks: list.sort(
        (a, b) => a.diameter - b.diameter || a.length - b.length
      ),
    }))
}
