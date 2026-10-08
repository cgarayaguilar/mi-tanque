import {
  duplicateRateMessage,
  knownPlaces,
  knownSpelling,
  rateFormSchema,
  rateFromForm,
  rateLabel,
  rateToForm,
  sameRate,
} from 'schemas/rates'
import { client, rate } from '../testing/fleetFixtures'

const empty = rateToForm(null)
const valid = {
  ...empty,
  origin: 'Managua',
  destination: 'San José',
  price: '25,000',
}

const messages = (values: object) => {
  const result = rateFormSchema.safeParse({ ...valid, ...values })
  return result.success
    ? []
    : result.error.issues.map(issue => [issue.path.join('.'), issue.message])
}

// backend specs/0024 RF-1, RF-6
describe('the form', () => {
  test('origin, destination and price are needed', () => {
    expect(messages({})).toEqual([])
    expect(messages({ origin: '' })).toContainEqual([
      'origin',
      'Escribe el origen',
    ])
    expect(messages({ destination: ' ' })).toContainEqual([
      'destination',
      'Escribe el destino',
    ])
  })

  test.each([
    ['', 'Escribe el precio'],
    ['mucho', 'Escribe solo números, por ejemplo 25,000'],
    ['0', 'Ingresa un precio mayor que 0'],
    ['0.001', 'Ingresa un precio mayor que 0'],
    ['100,000,001', 'El precio es demasiado alto'],
  ])('a price of "%s" says %s', (price, message) => {
    expect(messages({ price })).toContainEqual(['price', message])
  })

  test('the fields written carry the label, the currency and the client', () => {
    expect(
      rateFromForm(
        {
          ...valid,
          origin: ' Managua ',
          clientId: 'client-1',
          price: '25,000.456',
        },
        'NIO',
        [client()]
      )
    ).toEqual({
      origin: 'Managua',
      destination: 'San José',
      price: 25000.46,
      currency: 'NIO',
      clientId: 'client-1',
      clientName: 'Transportes Pérez',
      description: null,
      label: 'Managua - San José - C$25,000.46',
    })
    expect(rateFromForm(valid, 'USD', []).clientName).toBeNull()
  })

  test('the label has the symbol and no code', () => {
    expect(rateLabel('León', 'Tegucigalpa', 1200, 'USD')).toBe(
      'León - Tegucigalpa - $1,200.00'
    )
  })

  test('a stored rate goes back to the form', () => {
    expect(rateToForm(rate({ price: 25000.5 }))).toMatchObject({
      origin: 'Managua',
      price: '25,000.5',
      clientId: 'client-1',
    })
  })
})

// RF-8
describe('a repeated rate', () => {
  const rates = [rate(), rate({ id: 'rate-2', price: 18000, archived: true })]
  const candidate = {
    origin: 'managua',
    destination: '  San  Jose ',
    clientId: 'client-1',
    price: 25000,
  }

  test('same route, client and price, without accents or capitals', () => {
    expect(sameRate(candidate, rates, 'new')?.id).toBe('rate-1')
    expect(sameRate(candidate, rates, 'rate-1')).toBeNull()
  })

  test('another price or another client is another rate', () => {
    expect(sameRate({ ...candidate, price: 27000 }, rates, 'new')).toBeNull()
    expect(sameRate({ ...candidate, clientId: null }, rates, 'new')).toBeNull()
  })

  test('an archived one asks to restore it', () => {
    const other = sameRate({ ...candidate, price: 18000 }, rates, 'new')
    expect(other && duplicateRateMessage(other)).toBe(
      'Ya existe esta tarifa: Managua - San José - C$25,000.00. Restáurala en Archivados'
    )
  })
})

// RF-7, CA-3
test('the places suggested: origins and destinations, once each', () => {
  expect(
    knownPlaces([
      rate(),
      rate({ id: 'r2', origin: 'León', destination: 'managua' }),
      rate({ id: 'r3', origin: 'San Jose', destination: 'León' }),
    ])
  ).toEqual(['León', 'Managua', 'San José'])
})

test('a place typed another way is saved as it is already written', () => {
  const places = ['Managua', 'San José']
  expect(knownSpelling(' managua ', places)).toBe('Managua')
  expect(knownSpelling('SAN JOSE', places)).toBe('San José')
  expect(knownSpelling(' León ', places)).toBe('León')
})
