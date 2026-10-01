import { measurementFormSchema } from 'schemas/measurementForm'

const messageFor = (inches: string) =>
  measurementFormSchema(25)
    .safeParse({ inches })
    .error?.issues.map(issue => issue.message)

test.each(['12', '12,5', '12.5', '25', '0,5'])('accepts %j', inches => {
  expect(measurementFormSchema(25).safeParse({ inches }).success).toBe(true)
})

test('explains each kind of invalid value with a single message', () => {
  expect(messageFor('')).toEqual(['Ingresa las pulgadas que mediste'])
  expect(messageFor('doce')).toEqual(['Escribe solo números, por ejemplo 12.5'])
  expect(messageFor('0')).toEqual(['Ingresa un valor mayor que 0'])
  expect(messageFor('30')).toEqual([
    'Tu tanque mide 25 pulgadas de diámetro. Ingresa hasta 25.',
  ])
})
