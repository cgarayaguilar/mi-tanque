import * as z from 'zod/mini'
import { parseDecimal } from 'utils/parseDecimal'
import { formatNumber } from 'utils/formatNumber'

/**
 * The measurement form: the inches typed by the user, checked against the
 * tank they measured. Messages are shown inline under the field (§8.7).
 */
export const measurementFormSchema = (tankDiameter: number) =>
  z.object({
    inches: z.string().check(
      z.refine(value => value.trim() !== '', {
        error: 'Ingresa las pulgadas que mediste',
        abort: true,
      }),
      z.refine(value => !Number.isNaN(parseDecimal(value)), {
        error: 'Escribe solo números, por ejemplo 12.5',
        abort: true,
      }),
      z.refine(value => parseDecimal(value) > 0, {
        error: 'Ingresa un valor mayor que 0',
        abort: true,
      }),
      z.refine(value => parseDecimal(value) <= tankDiameter, {
        error: `Tu tanque mide ${formatNumber(tankDiameter)} pulgadas de diámetro. Ingresa hasta ${formatNumber(tankDiameter)}.`,
      })
    ),
  })

export type MeasurementFormValues = z.infer<
  ReturnType<typeof measurementFormSchema>
>

export const optionalOdometer = z.string().check(
  z.trim(),
  z.refine(value => value === '' || !Number.isNaN(parseDecimal(value)), {
    error: 'Escribe solo números, por ejemplo 120500',
    abort: true,
  }),
  z.refine(
    value =>
      value === '' ||
      (parseDecimal(value) >= 0 && parseDecimal(value) <= 5_000_000),
    { error: 'Revisa el odómetro' }
  )
)

/**
 * A fleet tank's measurement (backend specs/0004 RF-2): inches up to the
 * tank's measurable height, and the truck's odometer if it has one.
 */
export const cloudMeasurementFormSchema = (maxInches: number) =>
  z.object({
    inches: z.string().check(
      z.refine(value => value.trim() !== '', {
        error: 'Ingresa las pulgadas que mediste',
        abort: true,
      }),
      z.refine(value => !Number.isNaN(parseDecimal(value)), {
        error: 'Escribe solo números, por ejemplo 12.5',
        abort: true,
      }),
      z.refine(value => parseDecimal(value) > 0, {
        error: 'Ingresa un valor mayor que 0',
        abort: true,
      }),
      z.refine(value => parseDecimal(value) <= maxInches, {
        error: `Este tanque permite hasta ${formatNumber(maxInches)} pulgadas.`,
      })
    ),
    odometer: optionalOdometer,
  })

export type CloudMeasurementFormValues = z.infer<
  ReturnType<typeof cloudMeasurementFormSchema>
>
