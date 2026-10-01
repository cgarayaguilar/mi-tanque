import type { Currency } from 'schemas/account'

export interface PhoneCountry {
  code: string
  name: string
  dialCode: string
  /** Allowed lengths of the national number, in digits. */
  lengths: readonly number[]
  /** Suggested currency for a new organization (specs/0002 RF-7). */
  currency: Currency
}

/**
 * The only countries SMS sign-in is enabled for (the backend's SMS region
 * policy, specs/0002 RF-3). Order: as they appear along the routes.
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  {
    code: 'MX',
    name: 'México',
    dialCode: '52',
    lengths: [10],
    currency: 'MXN',
  },
  {
    code: 'US',
    name: 'Estados Unidos',
    dialCode: '1',
    lengths: [10],
    currency: 'USD',
  },
  {
    code: 'GT',
    name: 'Guatemala',
    dialCode: '502',
    lengths: [8],
    currency: 'GTQ',
  },
  {
    code: 'BZ',
    name: 'Belice',
    dialCode: '501',
    lengths: [7],
    currency: 'BZD',
  },
  {
    code: 'SV',
    name: 'El Salvador',
    dialCode: '503',
    lengths: [8],
    currency: 'USD',
  },
  {
    code: 'HN',
    name: 'Honduras',
    dialCode: '504',
    lengths: [8],
    currency: 'HNL',
  },
  {
    code: 'NI',
    name: 'Nicaragua',
    dialCode: '505',
    lengths: [8],
    currency: 'NIO',
  },
  {
    code: 'CR',
    name: 'Costa Rica',
    dialCode: '506',
    lengths: [8],
    currency: 'CRC',
  },
  {
    code: 'PA',
    name: 'Panamá',
    dialCode: '507',
    lengths: [7, 8],
    currency: 'USD',
  },
]

export const findPhoneCountry = (code: string): PhoneCountry | undefined =>
  PHONE_COUNTRIES.find(country => country.code === code)

/** Country of the browser's language ("es-NI" → NI) when it is in the list. */
export const defaultPhoneCountry = (
  languages: readonly string[] = navigator.languages
): PhoneCountry => {
  for (const language of languages) {
    const region = language.split('-')[1]?.toUpperCase()
    const country = region ? findPhoneCountry(region) : undefined
    if (country) return country
  }
  return PHONE_COUNTRIES[0] as PhoneCountry
}

/** Only the digits the user typed: spaces, dashes and dots are allowed. */
export const nationalDigits = (value: string) => value.replace(/[\s.-]/g, '')

export const toE164 = (country: PhoneCountry, nationalNumber: string) =>
  `+${country.dialCode}${nationalDigits(nationalNumber)}`

/** Currency for a new organization from a +E.164 number, if known. */
export const currencyForPhone = (e164: string | null): Currency | null => {
  if (!e164) return null
  const match = [...PHONE_COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find(country => e164.startsWith(`+${country.dialCode}`))
  return match?.currency ?? null
}
