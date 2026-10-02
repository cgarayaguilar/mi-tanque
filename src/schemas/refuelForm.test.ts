import { refuelFormSchema, type RefuelFormValues } from 'schemas/refuelForm'

const schema = refuelFormSchema({ maxInches: 25, maxGallons: 150 })

const values = (
  overrides: Partial<RefuelFormValues> = {}
): RefuelFormValues => ({
  quantity: '50',
  quantityUnit: 'liter',
  price: '30',
  priceUnit: 'liter',
  currency: 'NIO',
  total: '',
  inchesBefore: '',
  inchesAfter: '',
  odometer: '',
  stationName: '',
  ...overrides,
})

const errorsOf = (input: RefuelFormValues) => {
  const result = schema.safeParse(input)
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map(issue => [issue.path.join('.'), issue.message])
      )
}

test('a complete refuel is valid, with decimals written with a comma', () => {
  expect(errorsOf(values({ quantity: '13,5', price: '4,25' }))).toEqual({})
})

test('quantity, price and currency are required (RF-2)', () => {
  expect(errorsOf(values({ quantity: '', price: '', currency: '' }))).toEqual({
    quantity: 'Escribe cuánto echaste',
    price: 'Escribe el precio',
    currency: 'Elige la moneda',
  })
})

test('no more than twice the capacity, in the unit written', () => {
  expect(
    errorsOf(values({ quantity: '151', quantityUnit: 'gallon' }))
  ).toMatchObject({
    quantity: 'Es más del doble de lo que le cabe al tanque (75 gal).',
  })
  // 560 L ≈ 148 gal: still fits
  expect(errorsOf(values({ quantity: '560' }))).toEqual({})
})

test('prices up to 1000, inches up to the tank, after never below before', () => {
  expect(errorsOf(values({ price: '1001' }))).toMatchObject({
    price: 'Revisa el precio: es demasiado alto',
  })
  expect(errorsOf(values({ inchesBefore: '26' }))).toMatchObject({
    inchesBefore: 'Este tanque permite hasta 25 pulgadas.',
  })
  expect(
    errorsOf(values({ inchesBefore: '10', inchesAfter: '8' }))
  ).toMatchObject({
    inchesAfter: 'Después del relleno no puede haber menos que antes',
  })
  expect(errorsOf(values({ stationName: 'x'.repeat(61) }))).toMatchObject({
    stationName: 'Usa 60 caracteres como máximo',
  })
})

// Regression: per gallon the form stopped at 1000, while the rules allow
// about 3785 (1000 per liter): diesel in CRC per gallon could not be saved
test('per gallon the price goes up to what 1000 per liter is', () => {
  expect(errorsOf(values({ price: '2800', priceUnit: 'gallon' }))).toEqual({})
  expect(
    errorsOf(values({ price: '3786', priceUnit: 'gallon' }))
  ).toMatchObject({ price: 'Revisa el precio: es demasiado alto' })
})

// Regression: amounts that round to 0 when stored passed the form and were
// refused by the rules after "saved"
test('amounts too small to store are said', () => {
  expect(
    errorsOf(values({ quantity: '0.004', quantityUnit: 'gallon' }))
  ).toMatchObject({ quantity: 'Es muy poco para guardarlo' })
  expect(
    errorsOf(values({ price: '0.001', priceUnit: 'liter' }))
  ).toMatchObject({ price: 'El precio es demasiado bajo para guardarlo' })
})
