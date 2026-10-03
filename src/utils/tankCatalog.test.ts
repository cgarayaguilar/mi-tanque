import { PREDEFINED_TANKS } from 'services/tanks'
import {
  filterOptions,
  filterTanks,
  fitsText,
  groupByCapacity,
  measuresText,
  modelsOf,
  hasFilters,
  NO_FILTERS,
  type CatalogTank,
} from 'utils/tankCatalog'

const catalog: CatalogTank[] = PREDEFINED_TANKS.map((tank, index) => ({
  key: String(index),
  shape: 'cylinder',
  size: tank.shape === 'cylinder' ? tank.diameter : tank.height,
  width: null,
  length: tank.length,
  capacity: tank.capacity,
}))

// specs/0014 CA-1
test('the tanks are grouped by capacity, smallest first', () => {
  const groups = groupByCapacity(catalog)
  const capacities = groups.map(group => group.capacity)
  expect(capacities).toEqual([...capacities].sort((a, b) => a - b))
  const hundred = groups.find(group => group.capacity === 100)
  expect(
    hundred?.tanks.map(tank => `${String(tank.size)}x${String(tank.length)}`)
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
  expect(found[0]).toMatchObject({ size: 24, length: 54 })
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
    {
      key: 'a',
      shape: 'cylinder',
      size: 25,
      width: null,
      length: 26,
      capacity: 50,
    },
    {
      key: 'b',
      shape: 'cylinder',
      size: 24,
      width: null,
      length: 54,
      capacity: 100,
    },
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

const trucks: CatalogTank[] = [
  {
    key: 'kw-1',
    shape: 'cylinder',
    size: 24.5,
    width: null,
    length: 60.6,
    capacity: 120,
    brand: 'Kenworth',
    models: ['T680', 'T880'],
  },
  {
    key: 'kw-2',
    shape: 'cylinder',
    size: 22,
    width: null,
    length: 74.3,
    capacity: 120,
    brand: 'Kenworth',
    models: ['T680'],
  },
  {
    key: 'vo-1',
    shape: 'd_flat_side',
    size: 26,
    width: 26.4,
    length: 41.1,
    capacity: 100,
    brand: 'Volvo',
    models: ['VNL (2024+)'],
    calculated: true,
  },
  {
    key: 'fl-1',
    shape: 'rectangular',
    size: 18,
    width: 18.5,
    length: 38,
    capacity: 55,
    brand: 'Freightliner',
    models: ['M2 106'],
  },
]

// specs/0015 RF-7, CA-1
test('brand and model narrow the list, and combine with the rest', () => {
  expect(filterOptions(trucks).brands).toEqual([
    'Freightliner',
    'Kenworth',
    'Volvo',
  ])
  expect(modelsOf(trucks, 'Kenworth')).toEqual(['T680', 'T880'])
  const t680 = filterTanks(trucks, {
    ...NO_FILTERS,
    brand: 'Kenworth',
    model: 'T680',
  })
  expect(t680.map(tank => tank.key)).toEqual(['kw-1', 'kw-2'])
  expect(
    filterTanks(trucks, {
      ...NO_FILTERS,
      brand: 'Kenworth',
      model: 'T880',
      capacity: 120,
    }).map(tank => tank.key)
  ).toEqual(['kw-1'])
})

test('text finds a brand or a model; a "D" counts by its height', () => {
  expect(
    filterTanks(trucks, { ...NO_FILTERS, query: 'volvo' }).map(t => t.key)
  ).toEqual(['vo-1'])
  expect(
    filterTanks(trucks, { ...NO_FILTERS, query: 't880' }).map(t => t.key)
  ).toEqual(['kw-1'])
  expect(
    filterTanks(trucks, { ...NO_FILTERS, diameter: 26 }).map(t => t.key)
  ).toEqual(['vo-1'])
  // A box has no diameter to filter by
  expect(filterOptions(trucks).diameters).toEqual([22, 24.5, 26])
})

test('the card texts: measures by shape and where it fits', () => {
  expect(measuresText(trucks[0] as CatalogTank)).toBe('Ø 24.5 × 60.6 pulg.')
  expect(measuresText(trucks[2] as CatalogTank)).toBe(
    'En D · 26 × 26.4 × 41.1 pulg.'
  )
  expect(measuresText(trucks[3] as CatalogTank)).toBe(
    'Rectangular · 18 × 18.5 × 38 pulg.'
  )
  expect(fitsText(trucks[0] as CatalogTank, true)).toBe('Kenworth T680, T880')
  expect(
    fitsText(
      { ...(trucks[0] as CatalogTank), models: ['A', 'B', 'C', 'D'] },
      false
    )
  ).toBe('A, B y 2 más')
})

test('diameter chips go by the half inch, and "Genérico" is the last brand', () => {
  const tanks: CatalogTank[] = [
    {
      key: 'a',
      shape: 'd_flat_side',
      size: 19.35,
      width: 25,
      length: 57,
      capacity: 120,
      brand: 'International',
      models: ['HV'],
    },
    {
      key: 'b',
      shape: 'cylinder',
      size: 24,
      width: null,
      length: 54,
      capacity: 100,
      brand: 'Genérico',
      models: [],
    },
    {
      key: 'c',
      shape: 'cylinder',
      size: 26,
      width: null,
      length: 46,
      capacity: 100,
      brand: 'Volvo',
      models: ['VNM'],
    },
  ]
  const options = filterOptions(tanks)
  expect(options.diameters).toEqual([19.5, 24, 26])
  expect(options.brands).toEqual(['International', 'Volvo', 'Genérico'])
  expect(
    filterTanks(tanks, { ...NO_FILTERS, diameter: 19.5 }).map(t => t.key)
  ).toEqual(['a'])
})
