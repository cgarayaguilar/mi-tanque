import * as z from 'zod/mini'
import { CURRENCIES } from 'schemas/account'
import { optionalOdometer } from 'schemas/measurementForm'
import { formatNumber } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'
import { LITERS_PER_GALLON, type VolumeUnit } from 'utils/refuelMath'

// The refuel form (backend specs/0006 RF-2). Numbers are typed as in Central
// America ("1,500.50"; utils/parseDecimal); messages show under each field
// (§8.7).

export const STATION_MAX = 60
/** Per liter or per gallon, in the unit written (RF-2). */
export const PRICE_MAX = 1000
const TOTAL_MAX = 100_000_000

const isNumber = (value: string) => !Number.isNaN(parseDecimal(value))

const requiredDecimal = (missing: string) =>
  z.string().check(
    z.trim(),
    z.refine(value => value !== '', { error: missing, abort: true }),
    z.refine(isNumber, {
      error: 'Escribe solo números, por ejemplo 12.5',
      abort: true,
    }),
    z.refine(value => parseDecimal(value) > 0, {
      error: 'Ingresa un valor mayor que 0',
    })
  )

const optionalDecimal = (max: number, tooBig: string) =>
  z.string().check(
    z.trim(),
    z.refine(value => value === '' || isNumber(value), {
      error: 'Escribe solo números, por ejemplo 12.5',
      abort: true,
    }),
    z.refine(
      value =>
        value === '' ||
        (parseDecimal(value) >= 0 && parseDecimal(value) <= max),
      { error: tooBig }
    )
  )

const unit = z.enum(['gallon', 'liter'])

export const refuelFormSchema = ({
  maxInches,
  maxGallons,
}: {
  maxInches: number
  /** Twice the tank's capacity, like the backend rules. */
  maxGallons: number
}) =>
  z
    .object({
      quantity: requiredDecimal('Escribe cuánto echaste'),
      quantityUnit: unit,
      price: requiredDecimal('Escribe el precio'),
      priceUnit: unit,
      currency: z.string().check(
        z.refine(value => (CURRENCIES as readonly string[]).includes(value), {
          error: 'Elige la moneda',
        })
      ),
      /** '' = the computed total; a number corrects it from the invoice. */
      total: optionalDecimal(TOTAL_MAX, 'Revisa el total'),
      inchesBefore: optionalDecimal(
        maxInches,
        `Este tanque permite hasta ${formatNumber(maxInches)} pulgadas.`
      ),
      inchesAfter: optionalDecimal(
        maxInches,
        `Este tanque permite hasta ${formatNumber(maxInches)} pulgadas.`
      ),
      odometer: optionalOdometer,
      stationName: z.string().check(
        z.trim(),
        z.maxLength(STATION_MAX, {
          error: `Usa ${String(STATION_MAX)} caracteres como máximo`,
        })
      ),
    })
    .check(
      z.refine(
        ({ quantity, quantityUnit }) => {
          const amount = parseDecimal(quantity)
          if (Number.isNaN(amount)) return true
          const gallons =
            quantityUnit === 'gallon' ? amount : amount / LITERS_PER_GALLON
          return gallons <= maxGallons
        },
        {
          error: `Es más del doble de lo que le cabe al tanque (${formatNumber(Math.round(maxGallons / 2))} gal).`,
          path: ['quantity'],
        }
      ),
      z.refine(
        ({ price }) =>
          Number.isNaN(parseDecimal(price)) || parseDecimal(price) <= PRICE_MAX,
        {
          error: `Revisa el precio: hasta ${String(PRICE_MAX)}`,
          path: ['price'],
        }
      ),
      z.refine(
        ({ inchesBefore, inchesAfter }) =>
          inchesBefore.trim() === '' ||
          inchesAfter.trim() === '' ||
          parseDecimal(inchesAfter) >= parseDecimal(inchesBefore),
        {
          error: 'Después del relleno no puede haber menos que antes',
          path: ['inchesAfter'],
        }
      )
    )

export type RefuelFormValues = z.infer<ReturnType<typeof refuelFormSchema>>

export const VOLUME_UNIT_LABELS: Record<VolumeUnit, string> = {
  gallon: 'gal',
  liter: 'L',
}

/** '' as null, a typed decimal as a number. */
export const optionalNumber = (value: string): number | null =>
  value.trim() === '' ? null : parseDecimal(value)
