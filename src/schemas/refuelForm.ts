import * as z from 'zod/mini'
import { CURRENCIES } from 'schemas/account'
import { optionalOdometer } from 'schemas/measurementForm'
import { formatNumber } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'
import {
  LITERS_PER_GALLON,
  refuelAmounts,
  type VolumeUnit,
} from 'utils/refuelMath'

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

/**
 * The highest price in the unit written. The rules allow 1000 per liter,
 * which is about 3785 per gallon: 1000 per gallon left out diesel in CRC
 * (audit 2026-10-01).
 */
const priceMaxFor = (priceUnit: VolumeUnit) =>
  priceUnit === 'liter' ? PRICE_MAX : Math.floor(PRICE_MAX * LITERS_PER_GALLON)

/** Whether quantity and price stay above 0 once rounded as stored. */
const storedAmounts = (
  quantity: string,
  quantityUnit: VolumeUnit,
  price: string,
  priceUnit: VolumeUnit
) => {
  const amount = parseDecimal(quantity)
  const perUnit = parseDecimal(price)
  if (!(amount > 0) || !(perUnit > 0)) return null
  const stored = refuelAmounts({
    quantity: amount,
    quantityUnit,
    price: perUnit,
    priceUnit,
  })
  return {
    quantity: stored.gallonsAdded > 0 && stored.litersAdded > 0,
    price: stored.pricePerGallon > 0 && stored.pricePerLiter > 0,
  }
}

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
        ({ price, priceUnit }) =>
          Number.isNaN(parseDecimal(price)) ||
          parseDecimal(price) <= priceMaxFor(priceUnit),
        {
          error: 'Revisa el precio: es demasiado alto',
          path: ['price'],
        }
      ),
      // What is stored has 2 decimals; the rules ask more than 0 (audit
      // 2026-10-01): 0.004 gal or 0.001 per liter rounded to 0 and the
      // refuel was refused after "saved"
      z.refine(
        ({ quantity, quantityUnit, price, priceUnit }) =>
          storedAmounts(quantity, quantityUnit, price, priceUnit)?.quantity ??
          true,
        { error: 'Es muy poco para guardarlo', path: ['quantity'] }
      ),
      z.refine(
        ({ quantity, quantityUnit, price, priceUnit }) =>
          storedAmounts(quantity, quantityUnit, price, priceUnit)?.price ??
          true,
        { error: 'El precio es demasiado bajo para guardarlo', path: ['price'] }
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

// Written in full: "L" is also the lempira's symbol (backend specs/0012 RF-7)
export const VOLUME_UNIT_LABELS: Record<VolumeUnit, string> = {
  gallon: 'galones',
  liter: 'litros',
}

/** '' as null, a typed decimal as a number. */
export const optionalNumber = (value: string): number | null =>
  value.trim() === '' ? null : parseDecimal(value)
