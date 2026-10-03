import {
  buildTruckTanks,
  modelNames,
  parseYears,
  type ResearchRecord,
} from 'data/buildTruckTanks'
import truckTanks from 'data/truckTanks.json'
import paccar from '../../data/tank-research/paccar.json'
import volvoMack from '../../data/tank-research/volvo-mack.json'
import daimler from '../../data/tank-research/daimler.json'
import navistar from '../../data/tank-research/navistar.json'

const record = (overrides: Partial<ResearchRecord>): ResearchRecord => ({
  brand: 'Kenworth',
  models: ['T680'],
  years: '2013-2024',
  shape: 'cylinder',
  diameterIn: 24.5,
  heightIn: null,
  widthIn: null,
  lengthIn: 50,
  capacityGal: 100,
  source: 'https://example.com/kw',
  sourceType: 'oem',
  notes: null,
  ...overrides,
})

// specs/0015 RNF-3: the app's file is what the script makes of the research
test('src/data/truckTanks.json is the build of the research files', () => {
  const records = [
    ...paccar,
    ...volvoMack,
    ...daimler,
    ...navistar,
  ] as ResearchRecord[]
  expect(buildTruckTanks(records).tanks).toEqual(truckTanks)
})

test('years: ranges, open ends and several ranges in one text', () => {
  expect(parseYears('2008-2018')).toEqual({ from: 2008, to: 2018 })
  expect(parseYears('2018-')).toEqual({ from: 2018, to: Infinity })
  expect(parseYears('2024-present')).toEqual({ from: 2024, to: Infinity })
  expect(parseYears('ProStar 2008-2018; 8600/TranStar 2006-2018')).toEqual({
    from: 2006,
    to: 2018,
  })
  expect(parseYears(null)).toBeNull()
})

// specs/0015 RF-5
test('models get their generation where the tanks changed', () => {
  expect(modelNames('Freightliner', 'New Cascadia', '2018-')).toEqual([
    'Cascadia (2018+)',
  ])
  expect(modelNames('Kenworth', 'W900L', '2000-2007')).toEqual([
    'W900L (2000–2007)',
  ])
  expect(modelNames('Kenworth', 'T800', '2012-2024')).toEqual(['T800 (2008+)'])
  expect(modelNames('Volvo', 'VNL 860', '2024-present')).toEqual([
    'VNL (2024+)',
  ])
  expect(modelNames('Volvo', 'VNL (Gen II)', '1998-2018')).toEqual([
    'VNL (2000–2017)',
    'VNL (2018–2023)',
  ])
  // Before 2000: out of scope
  expect(modelNames('Peterbilt', '379', '1990-1998')).toEqual([])
  expect(() => modelNames('Volvo', 'VNX', null)).toThrow('No model rule')
})

// specs/0015 RF-2
test('the same tank from two sources is one, with the factory length', () => {
  const { tanks, sources } = buildTruckTanks([
    record({ lengthIn: 50 }),
    record({
      models: ['T880'],
      lengthIn: 51.5,
      sourceType: 'aftermarket',
      source: 'https://example.com/shop',
    }),
  ])
  expect(tanks).toHaveLength(1)
  expect(tanks[0]).toMatchObject({
    id: 'kw-c24.5x50-100',
    dimensions: { diameterIn: 24.5, lengthIn: 50 },
    models: ['T680', 'T880'],
  })
  expect(sources['kw-c24.5x50-100']).toHaveLength(2)
})

test('the total capacity, with the useable one apart', () => {
  const { tanks } = buildTruckTanks([
    record({
      brand: 'Peterbilt',
      models: ['389'],
      diameterIn: 26,
      lengthIn: 26.7,
      capacityGal: 50,
      notes: 'PB HD BBM Table 3-26: 50 useable / 57 total gal',
    }),
  ])
  expect(tanks[0]).toMatchObject({ capacityGal: 57, usableGal: 50 })
})

// specs/0015 RF-3
test('a missing length comes from the family table, marked', () => {
  const table = [60, 80, 100, 150].map(capacity =>
    record({
      brand: 'Western Star',
      models: ['4900'],
      years: null,
      diameterIn: 25,
      capacityGal: capacity,
      lengthIn: { 60: 30.5, 80: 40, 100: 50, 150: 73 }[capacity] ?? 0,
    })
  )
  const { tanks } = buildTruckTanks([
    ...table,
    record({
      brand: 'Freightliner',
      models: ['New Cascadia'],
      years: '2018-',
      diameterIn: 25,
      capacityGal: 120,
      lengthIn: null,
    }),
  ])
  const cascadia = tanks.find(tank => tank.brand === 'Freightliner')
  expect(cascadia?.calculated).toEqual(['length'])
  expect(cascadia?.dimensions.lengthIn).toBeGreaterThan(58)
  expect(cascadia?.dimensions.lengthIn).toBeLessThan(62)
})

test('a "D" without width gets it from its capacity, marked', () => {
  const { tanks } = buildTruckTanks([
    record({
      brand: 'Volvo',
      models: ['VHD'],
      years: '2017-2023',
      shape: 'd',
      diameterIn: null,
      heightIn: 26,
      lengthIn: 41.1,
      capacityGal: 100,
    }),
  ])
  expect(tanks[0]?.shape).toBe('d_flat_side')
  expect(tanks[0]?.calculated).toEqual(['width'])
  const width =
    tanks[0] && 'widthIn' in tanks[0].dimensions
      ? tanks[0].dimensions.widthIn
      : 0
  expect(width).toBeGreaterThan(24)
  expect(width).toBeLessThan(28)
})

// specs/0015 RF-4
test('what cannot be trusted is left out, with its reason', () => {
  const { tanks, discarded } = buildTruckTanks([
    record({ models: [] }),
    record({ notes: 'Data from search snippet only' }),
    record({ diameterIn: null }),
    record({ shape: 'rectangular', diameterIn: null, heightIn: 18 }),
    record({ models: ['379'], years: '1990-1998', brand: 'Peterbilt' }),
    record({ capacityGal: 60 }),
  ])
  expect(tanks).toHaveLength(0)
  expect(discarded.map(item => item.reason)).toEqual([
    'sin modelo',
    'solo el texto de un buscador o de un título',
    'falta el diámetro o el alto',
    'rectangular sin sección completa',
    'camiones anteriores al 2000',
    expect.stringMatching(/^la capacidad no cuadra con las medidas/),
  ])
})

test('a record without a source stops the build', () => {
  expect(() => buildTruckTanks([record({ source: '' })])).toThrow(
    'without a source'
  )
})
