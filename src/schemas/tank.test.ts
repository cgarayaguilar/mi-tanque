import {
  parseTankDimensions,
  readTankDimensions,
  tankFormSchema,
  tankFromForm,
} from 'schemas/tank'
import { EMPTY_TANK_MEASURES } from 'schemas/tankMeasures'

// backend specs/0019 RF-2: what older builds stored is a lying cylinder
test('accepts strings and no shape from older forms, and returns numbers', () => {
  expect(
    parseTankDimensions({ capacity: '80', diameter: '22', length: '50' })
  ).toEqual({
    capacity: 80,
    shape: 'cylinder',
    orientation: 'horizontal',
    diameter: 22,
    length: 50,
  })
})

test('rejects stored dimensions outside the limits', () => {
  expect(() =>
    parseTankDimensions({ capacity: 300, diameter: 'abc', length: 50 })
  ).toThrow()
})

// specs/0019 RF-1
test('a D tank or a box is stored with its height and width', () => {
  expect(
    parseTankDimensions({
      capacity: 100,
      shape: 'd_flat_side',
      orientation: 'horizontal',
      height: 26,
      width: 27,
      length: 41,
    })
  ).toEqual({
    capacity: 100,
    shape: 'd_flat_side',
    orientation: 'horizontal',
    height: 26,
    width: 27,
    length: 41,
  })
  // A "D" with no room for its half circle
  expect(() =>
    parseTankDimensions({
      capacity: 100,
      shape: 'd_flat_side',
      orientation: 'horizontal',
      height: 40,
      width: 15,
      length: 41,
    })
  ).toThrow()
})

test('reading back is lenient but needs the measures of the shape', () => {
  expect(
    readTankDimensions({ capacity: '80', diameter: '22', length: '50' })
  ).toMatchObject({ shape: 'cylinder', diameter: 22 })
  expect(
    readTankDimensions({ capacity: 80, shape: 'rectangular', length: 50 })
  ).toBeNull()
  expect(readTankDimensions(null)).toBeNull()
})

const form = (values: Partial<typeof EMPTY_TANK_MEASURES>) => ({
  ...EMPTY_TANK_MEASURES,
  capacity: '80',
  diameter: '22',
  length: '50',
  ...values,
})

const formMessages = (values: Partial<typeof EMPTY_TANK_MEASURES>) =>
  tankFormSchema
    .safeParse(form(values))
    .error?.issues.map(issue => [issue.path.join('.'), issue.message])

test.each([
  { capacity: '80', diameter: '24,5', length: '50' },
  // The limits, with measures that fit the capacity (twice at most)
  { capacity: '10', diameter: '10', length: '10' },
  { capacity: '250', diameter: '30', length: '150' },
  { capacity: '120.5', diameter: '24', length: '64' },
])('the form accepts %j', values => {
  expect(tankFormSchema.safeParse(form(values)).success).toBe(true)
})

test('the form explains each field with a single message', () => {
  expect(formMessages({ capacity: '' })).toEqual([
    ['capacity', 'Escribe la capacidad entre 10 y 250 galones'],
  ])
  expect(formMessages({ diameter: 'veinte' })).toEqual([
    ['diameter', 'Escribe el diámetro entre 10 y 99 pulgadas'],
  ])
  expect(formMessages({ length: '9' })).toEqual([
    ['length', 'Escribe el largo entre 10 y 150 pulgadas'],
  ])
})

// specs/0019 RF-3, RF-5, CA-3
test('the form asks each shape for its own measures', () => {
  const standingBox = {
    shape: 'rectangular',
    orientation: 'vertical',
    capacity: '80',
    height: '20',
    width: '24',
    length: '40',
    diameter: '',
  } as const
  expect(tankFormSchema.safeParse(form(standingBox)).success).toBe(true)
  expect(tankFromForm(form(standingBox))).toEqual({
    capacity: 80,
    shape: 'rectangular',
    orientation: 'vertical',
    height: 20,
    width: 24,
    length: 40,
  })
  expect(formMessages({ ...standingBox, height: '' })).toEqual([
    ['height', 'Escribe el alto entre 10 y 99 pulgadas'],
  ])
  expect(formMessages({ ...standingBox, length: '151' })).toEqual([
    ['length', 'Escribe la altura entre 10 y 150 pulgadas'],
  ])
})
