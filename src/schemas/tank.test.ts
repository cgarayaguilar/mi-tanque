import { tankDimensionsSchema, tankFormSchema } from 'schemas/tank'

test('accepts strings from older forms and returns numbers', () => {
  expect(
    tankDimensionsSchema.parse({ capacity: '80', diameter: '22', length: '50' })
  ).toEqual({ capacity: 80, diameter: 22, length: 50 })
})

test('rejects stored dimensions outside the limits', () => {
  const result = tankDimensionsSchema.safeParse({
    capacity: 300,
    diameter: 'abc',
    length: 50,
  })

  expect(result.error?.issues.map(issue => issue.message)).toEqual([
    'Debe estar entre 10 y 250 galones',
    'Escribe solo números',
  ])
})

const formMessages = (values: Partial<Record<string, string>>) =>
  tankFormSchema
    .safeParse({ capacity: '80', diameter: '22', length: '50', ...values })
    .error?.issues.map(issue => [issue.path.join('.'), issue.message])

test.each([
  { capacity: '80', diameter: '24,5', length: '50' },
  { capacity: '10', diameter: '99', length: '150' },
  { capacity: '120.5', diameter: '24', length: '64' },
])('the form accepts %j', values => {
  expect(tankFormSchema.safeParse(values).success).toBe(true)
})

test('the form explains each field with a single message', () => {
  expect(formMessages({ capacity: '' })).toEqual([
    ['capacity', 'Ingresa la capacidad'],
  ])
  expect(formMessages({ diameter: 'veinte' })).toEqual([
    ['diameter', 'Escribe solo números, por ejemplo 24,5'],
  ])
  expect(formMessages({ length: '9' })).toEqual([
    ['length', 'Debe estar entre 10 y 150 pulgadas'],
  ])
})
