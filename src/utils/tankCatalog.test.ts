import { PREDEFINED_TANKS } from 'services/tanks'
import {
  filterOptions,
  filterTanks,
  groupByCapacity,
  hasFilters,
  NO_FILTERS,
  type CatalogTank,
} from 'utils/tankCatalog'

const catalog: CatalogTank[] = PREDEFINED_TANKS.map((tank, index) => ({
  key: String(index),
  ...tank,
}))

// specs/0014 CA-1
test('the tanks are grouped by capacity, smallest first', () => {
  const groups = groupByCapacity(catalog)
  const capacities = groups.map(group => group.capacity)
  expect(capacities).toEqual([...capacities].sort((a, b) => a - b))
  const hundred = groups.find(group => group.capacity === 100)
  expect(
    hundred?.tanks.map(
      tank => `${String(tank.diameter)}x${String(tank.length)}`
    )
  ).toEqual(['23x61', '24x54', '26x48'])
})

// specs/0014 CA-2
test('capacity and diameter combine', () => {
  const found = filterTanks(catalog, {
    ...NO_FILTERS,
    capacity: 100,
    diameter: 24,
  })
  expect(found).toHaveLength(1)
  expect(found[0]).toMatchObject({ diameter: 24, length: 54 })
})

// specs/0014 CA-3
test('"Más de 60" leaves only the longer tanks', () => {
  const found = filterTanks(catalog, { ...NO_FILTERS, length: 'long' })
  expect(found.length).toBeGreaterThan(0)
  expect(found.every(tank => tank.length > 60)).toBe(true)
})

// specs/0014 CA-4
test('a number finds it in any measure', () => {
  const found = filterTanks(catalog, { ...NO_FILTERS, query: '54' })
  expect(found.length).toBeGreaterThan(0)
  expect(found.every(tank => tank.length === 54)).toBe(true)
})

test('the chips only offer values some tank has', () => {
  const options = filterOptions([
    { key: 'a', capacity: 50, diameter: 25, length: 26 },
    { key: 'b', capacity: 100, diameter: 24, length: 54 },
  ])
  expect(options.capacities).toEqual([50, 100])
  expect(options.diameters).toEqual([24, 25])
  expect(options.lengths.map(range => range.id)).toEqual(['short', 'medium'])
})

test('no filter keeps everything', () => {
  expect(filterTanks(catalog, NO_FILTERS)).toHaveLength(catalog.length)
  expect(hasFilters(NO_FILTERS)).toBe(false)
  expect(hasFilters({ ...NO_FILTERS, query: '2' })).toBe(true)
})
