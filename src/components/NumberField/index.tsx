import type { UseFormRegisterReturn } from 'react-hook-form'
import TextField from 'components/TextField'

interface NumberFieldProps {
  id: string
  label: string
  /** Short unit shown inside the field, e.g. "pulg.". */
  unit: string
  placeholder: string
  /** Shown under the field until there is an error. */
  hint: string
  error?: string | undefined
  registration: UseFormRegisterReturn
}

/**
 * Decimal input with its unit. Text, not type="number", so "12,5" works on
 * every keyboard.
 */
export default function NumberField({ unit, ...props }: NumberFieldProps) {
  return <TextField {...props} inputMode="decimal" endAdornment={unit} />
}
