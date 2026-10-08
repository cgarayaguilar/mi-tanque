import {
  driverContact,
  driverFormSchema,
  driverFromForm,
  driverLinkedTo,
  driverToForm,
  driverWithName,
  duplicateDriverMessage,
} from 'schemas/drivers'
import { driver } from '../testing/fleetFixtures'

const empty = driverToForm(null)

const messages = (values: object) => {
  const result = driverFormSchema.safeParse({ ...empty, ...values })
  return result.success
    ? []
    : result.error.issues.map(issue => [issue.path.join('.'), issue.message])
}

// backend specs/0023 RF-1, RF-7
describe('the form', () => {
  test('only the name is needed; the rest is stored as null', () => {
    expect(messages({ name: 'Pedro Ruiz' })).toEqual([])
    expect(driverFromForm({ ...empty, name: ' Pedro Ruiz ' })).toEqual({
      name: 'Pedro Ruiz',
      phone: null,
      licenseNumber: null,
      licenseExpiresOn: null,
      memberUid: null,
    })
  })

  test.each([
    [{ name: '' }, 'name', 'Escribe el nombre del conductor'],
    [{ name: 'x'.repeat(61) }, 'name', 'Usa 60 caracteres como máximo'],
    [
      { name: 'A', licenseNumber: '1'.repeat(31) },
      'licenseNumber',
      'Usa 30 caracteres como máximo',
    ],
    [
      { name: 'A', licenseExpiresOn: 'invalid' },
      'licenseExpiresOn',
      'Escribe una fecha válida',
    ],
  ])('%o says %s: %s', (values, field, message) => {
    expect(messages(values)).toContainEqual([field, message])
  })

  test('a stored driver goes back to the form; a date that does not exist is left out', () => {
    expect(
      driverToForm(driver({ licenseExpiresOn: '2027-03-15', memberUid: 'ana' }))
    ).toMatchObject({ licenseExpiresOn: '2027-03-15', memberUid: 'ana' })
    expect(
      driverToForm(driver({ licenseExpiresOn: '2027-02-31' })).licenseExpiresOn
    ).toBe('')
  })
})

// RF-8
describe('not repeated', () => {
  const drivers = [
    driver({ memberUid: 'ana' }),
    driver({
      id: 'driver-2',
      name: 'Luis Mora',
      archived: true,
      memberUid: 'luis',
    }),
  ]

  test('the name, without accents, capitals or extra spaces', () => {
    expect(driverWithName('  pedro   RUIZ', drivers, 'new')?.id).toBe(
      'driver-1'
    )
    expect(driverWithName('Pedro Ruiz', drivers, 'driver-1')).toBeNull()
    const archived = driverWithName('luis mora', drivers, 'new')
    expect(archived && duplicateDriverMessage(archived)).toBe(
      'Ya existe un conductor archivado con ese nombre. Restáuralo en Archivados'
    )
  })

  test('a member, once among the active drivers', () => {
    expect(driverLinkedTo('ana', drivers, 'new')?.name).toBe('Pedro Ruiz')
    expect(driverLinkedTo('ana', drivers, 'driver-1')).toBeNull()
    // An archived driver does not hold the member
    expect(driverLinkedTo('luis', drivers, 'new')).toBeNull()
  })
})

test('the contact line has what the driver has (RF-6)', () => {
  expect(driverContact(driver())).toBe('8888 7777 · Licencia A-123456')
  expect(driverContact(driver({ phone: null, licenseNumber: null }))).toBeNull()
})
