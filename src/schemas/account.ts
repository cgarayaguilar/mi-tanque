// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import { findPhoneCountry, nationalDigits } from 'utils/phoneCountries'

/** Same limits as the `account` callable (solocamioneros-backend). */
export const NAME_MIN = 2
export const NAME_MAX = 60

export const CURRENCIES = [
  'USD',
  'MXN',
  'GTQ',
  'BZD',
  'HNL',
  'NIO',
  'CRC',
  'PAB',
] as const
export type Currency = (typeof CURRENCIES)[number]

interface CurrencyDetails {
  /** Plural and demonym, as people say it: "Córdobas nicaragüenses". */
  name: string
  /** Written before amounts: "C$9,274.26 NIO" (specs/0012 RF-2). */
  symbol: string
  /** Where it is used, so the list finds it by country. */
  countries: string
}

// specs/0012 RF-1
export const CURRENCY_DETAILS: Record<Currency, CurrencyDetails> = {
  USD: {
    name: 'Dólares estadounidenses',
    symbol: '$',
    countries: 'Estados Unidos El Salvador Panamá',
  },
  MXN: { name: 'Pesos mexicanos', symbol: '$', countries: 'México' },
  GTQ: { name: 'Quetzales guatemaltecos', symbol: 'Q', countries: 'Guatemala' },
  BZD: { name: 'Dólares beliceños', symbol: 'BZ$', countries: 'Belice' },
  HNL: { name: 'Lempiras hondureños', symbol: 'L', countries: 'Honduras' },
  NIO: { name: 'Córdobas nicaragüenses', symbol: 'C$', countries: 'Nicaragua' },
  CRC: {
    name: 'Colones costarricenses',
    symbol: '₡',
    countries: 'Costa Rica',
  },
  PAB: { name: 'Balboas panameños', symbol: 'B/.', countries: 'Panamá' },
}

/**
 * For selects: "Córdobas nicaragüenses (C$)", found by name, code or
 * country ("nio", "nicaragua").
 */
export const CURRENCY_OPTIONS = CURRENCIES.map(currency => {
  const { name, symbol, countries } = CURRENCY_DETAILS[currency]
  return {
    value: currency,
    label: `${name} (${symbol})`,
    keywords: `${currency} ${countries}`,
  }
})

const name = (missing: string) =>
  z.string().check(
    z.trim(),
    z.minLength(1, { error: missing, abort: true }),
    z.minLength(NAME_MIN, {
      error: `Escribe al menos ${String(NAME_MIN)} letras`,
    }),
    z.maxLength(NAME_MAX, {
      error: `Usa ${String(NAME_MAX)} caracteres como máximo`,
    })
  )

export const personNameSchema = name('Escribe tu nombre')
export const organizationNameSchema = name(
  'Escribe el nombre de tu organización'
)
export const currencySchema = z.enum(CURRENCIES, { error: 'Elige una moneda' })

export const phoneFormSchema = z
  .object({ country: z.string(), number: z.string() })
  .check(
    z.refine(({ number }) => nationalDigits(number) !== '', {
      error: 'Escribe tu número',
      path: ['number'],
      abort: true,
    }),
    z.refine(({ number }) => /^\d+$/.test(nationalDigits(number)), {
      error: 'Escribe solo números',
      path: ['number'],
      abort: true,
    }),
    z.refine(
      ({ country, number }) =>
        findPhoneCountry(country)?.lengths.includes(
          nationalDigits(number).length
        ) ?? false,
      {
        error: 'Revisa el número: no tiene los dígitos de ese país',
        path: ['number'],
      }
    )
  )
export type PhoneFormValues = z.infer<typeof phoneFormSchema>

export const codeFormSchema = z.object({
  code: z
    .string()
    .check(
      z.trim(),
      z.regex(/^\d{6}$/, { error: 'Escribe los 6 números del código' })
    ),
})
export type CodeFormValues = z.infer<typeof codeFormSchema>

export const welcomeFormSchema = z.object({
  // Only asked when the sign-in brings no name (phone)
  displayName: z.optional(personNameSchema),
  orgName: organizationNameSchema,
  currency: currencySchema,
})
export type WelcomeFormValues = z.infer<typeof welcomeFormSchema>

export const profileFormSchema = z.object({ displayName: personNameSchema })
/** Joining with a profile already: the name is not asked (specs/0005 RF-4). */
export const joinFormSchema = z.object({ displayName: z.string() })
export type ProfileFormValues = z.infer<typeof profileFormSchema>

export const organizationFormSchema = z.object({
  name: organizationNameSchema,
  defaultCurrency: currencySchema,
})
export type OrganizationFormValues = z.infer<typeof organizationFormSchema>

/** Mi cuenta → Organización: also the distance unit (backend specs/0010). */
export const organizationSettingsSchema = z.object({
  name: organizationNameSchema,
  defaultCurrency: currencySchema,
  distanceUnit: z.enum(['km', 'mi']),
})
export type OrganizationSettingsValues = z.infer<
  typeof organizationSettingsSchema
>
