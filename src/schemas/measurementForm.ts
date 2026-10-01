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
        error: 'Escribe solo números, por ejemplo 12,5',
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
