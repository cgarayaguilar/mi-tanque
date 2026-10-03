import * as z from 'zod/mini'
import { parseDecimal } from 'utils/parseDecimal'
import { formatNumber } from 'utils/formatNumber'

/**
 * The measurement form: the inches typed by the user, checked against the
 * tank they measured. Messages are shown inline under the field (§8.7).
 */
/**
 * `maxInches` is the tank's inside height to the fuel: the diameter, the
 * height or, standing, its length (backend specs/0019 RF-7), as `name` says.
 */
export const measurementFormSchema = (
  maxInches: number,
  name = 'el diámetro'
) =>
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
        error: `Tu tanque mide ${formatNumber(maxInches)} pulgadas de ${name.replace(/^(el|la) /, '')}. Ingresa hasta ${formatNumber(maxInches)}.`,
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

/** Inches of a fleet tank, up to its measurable height (specs/0004 RF-2). */
const fleetInches = (maxInches: number) =>
  z.string().check(
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
  )

/** Measuring a fleet tank: only the inches; the odometer is added on edit. */
export const fleetMeasureFormSchema = (maxInches: number) =>
  z.object({ inches: fleetInches(maxInches) })

export type FleetMeasureFormValues = z.infer<
  ReturnType<typeof fleetMeasureFormSchema>
>

/** Editing a fleet measurement: the inches and the truck's odometer (RF-12). */
export const cloudMeasurementFormSchema = (maxInches: number) =>
  z.object({ inches: fleetInches(maxInches), odometer: optionalOdometer })

export type CloudMeasurementFormValues = z.infer<
  ReturnType<typeof cloudMeasurementFormSchema>
>
