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

export const CURRENCY_NAMES: Record<Currency, string> = {
  USD: 'Dólar estadounidense',
  MXN: 'Peso mexicano',
  GTQ: 'Quetzal',
  BZD: 'Dólar beliceño',
  HNL: 'Lempira',
  NIO: 'Córdoba',
  CRC: 'Colón costarricense',
  PAB: 'Balboa',
}

/** For selects: "NIO · Córdoba". */
export const CURRENCY_OPTIONS = CURRENCIES.map(currency => ({
  value: currency,
  label: `${currency} · ${CURRENCY_NAMES[currency]}`,
}))

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
export type ProfileFormValues = z.infer<typeof profileFormSchema>

export const organizationFormSchema = z.object({
  name: organizationNameSchema,
  defaultCurrency: currencySchema,
})
export type OrganizationFormValues = z.infer<typeof organizationFormSchema>
