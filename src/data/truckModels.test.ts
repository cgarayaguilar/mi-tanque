import {
  catalogFilterFor,
  matchBrand,
  matchModel,
  TRUCK_BRANDS,
  TRUCK_MODELS,
} from 'data/truckModels'
import { TANK_TEMPLATES } from 'utils/tankTemplates'

const catalogModels = (brand: string) =>
  new Set(
    TANK_TEMPLATES.filter(template => template.brand === brand).flatMap(
      template => template.models
    )
  )

// specs/0016 RF-1: the list and the tank catalog agree
test.each(TRUCK_BRANDS)(
  '%s: every catalog model is reachable, and nothing else',
  brand => {
    const reachable = new Set(
      (TRUCK_MODELS[brand] ?? []).flatMap(model =>
        model.tanks.map(tank => tank.model)
      )
    )
    expect([...reachable].sort()).toEqual([...catalogModels(brand)].sort())
  }
)

test('every catalog brand is in the list', () => {
  const brands = new Set(
    TANK_TEMPLATES.filter(template => template.sourced).map(
      template => template.brand
    )
  )
  expect([...brands].sort()).toEqual([...TRUCK_BRANDS].sort())
})

// specs/0016 RF-5
test('typed names are recognized whatever their case, accents or spaces', () => {
  expect(matchBrand('freightliner')).toBe('Freightliner')
  expect(matchBrand(' WESTERN  STAR ')).toBe('Western Star')
  expect(matchBrand('Hino')).toBeNull()
  expect(matchModel('Freightliner', 'cascadia')).toBe('Cascadia')
  expect(matchModel('Volvo', 'vt880')).toBe('VT 880')
  expect(matchModel('Volvo', 'Cascadia')).toBeNull()
})

// specs/0016 RF-6, CA-4
test('the catalog opens on the truck: brand, and generation by year', () => {
  expect(catalogFilterFor('Freightliner', 'Cascadia', 2019)).toEqual({
    brand: 'Freightliner',
    model: 'Cascadia (2018+)',
  })
  expect(catalogFilterFor('freightliner', 'cascadia', 2012)).toEqual({
    brand: 'Freightliner',
    model: 'Cascadia (2008–2017)',
  })
  // No year: several generations, the brand alone
  expect(catalogFilterFor('Freightliner', 'Cascadia', null)).toEqual({
    brand: 'Freightliner',
    model: null,
  })
  // One generation: no year needed
  expect(catalogFilterFor('Kenworth', 'T680', null)).toEqual({
    brand: 'Kenworth',
    model: 'T680',
  })
  expect(catalogFilterFor('Hino', '500', 2019)).toBeNull()
  expect(catalogFilterFor('Volvo', null, 2019)).toEqual({
    brand: 'Volvo',
    model: null,
  })
})
