import type { ReactNode } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import TextField from 'components/TextField'

interface NumberFieldProps {
  id: string
  label: string
  /** Short unit shown inside the field, at the end, e.g. "pulg.". */
  unit?: string | undefined
  /** Shown inside the field before the number, e.g. "C$" (specs/0012 RF-4). */
  prefix?: string | undefined
  placeholder: string
  /** Shown under the field until there is an error. */
  hint?: string
  error?: string | undefined
  registration: UseFormRegisterReturn
  /** Next to the label, e.g. the ⓘ of a measure (specs/0013 RF-4). */
  help?: ReactNode
  /** Less inner padding, for a row of measures. */
  dense?: boolean
}

/**
 * Decimal input with its unit. Text, not type="number", so "1,500.5" and
 * keyboards that offer only a comma both work (utils/parseDecimal).
 */
export default function NumberField({
  unit,
  prefix,
  ...props
}: NumberFieldProps) {
  return (
    <TextField
      {...props}
      inputMode="decimal"
      startAdornment={prefix || undefined}
      endAdornment={unit || undefined}
    />
  )
}
