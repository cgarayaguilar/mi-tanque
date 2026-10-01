import { tankDimensionsSchema } from 'schemas/tank'

test('accepts form strings and returns numbers', () => {
  expect(
    tankDimensionsSchema.parse({ capacity: '80', diameter: '22', length: '50' })
  ).toEqual({ capacity: 80, diameter: 22, length: 50 })
})

test('explains out-of-range and non-numeric values in the product voice', () => {
  const result = tankDimensionsSchema.safeParse({
    capacity: '300',
    diameter: 'abc',
    length: '50',
  })

  expect(result.error?.issues.map(issue => issue.message)).toEqual([
    'Ingresa una capacidad entre 10 y 250',
    'Ingresa un diámetro en números',
  ])
})
