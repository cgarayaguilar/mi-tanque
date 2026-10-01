import {
  currencyForPhone,
  defaultPhoneCountry,
  findPhoneCountry,
  toE164,
} from 'utils/phoneCountries'

test('builds the international number from what the user typed', () => {
  const nicaragua = findPhoneCountry('NI')
  if (!nicaragua) throw new Error('NI missing')

  expect(toE164(nicaragua, '8888-77.77')).toBe('+50588887777')
})

test('suggests the currency of the phone country (longest prefix wins)', () => {
  expect(currencyForPhone('+50588887777')).toBe('NIO')
  expect(currencyForPhone('+525512345678')).toBe('MXN')
  expect(currencyForPhone('+15551234567')).toBe('USD')
  expect(currencyForPhone('+50312345678')).toBe('USD')
  expect(currencyForPhone(null)).toBeNull()
  expect(currencyForPhone('+34600000000')).toBeNull()
})

test('the default country follows the browser language when it is offered', () => {
  expect(defaultPhoneCountry(['es-HN', 'es']).code).toBe('HN')
  expect(defaultPhoneCountry(['en-GB', 'es-CR']).code).toBe('CR')
  expect(defaultPhoneCountry(['es-ES']).code).toBe('MX')
})
