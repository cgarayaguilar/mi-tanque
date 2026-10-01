import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import InputAdornment from '@mui/material/InputAdornment'
import OutlinedInput from '@mui/material/OutlinedInput'
import type { UseFormRegisterReturn } from 'react-hook-form'

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
 * Decimal input for React Hook Form (§8.7): visible label, unit, and one line
 * under the field that shows the hint or the error. Text, not type="number",
 * so "12,5" works on every keyboard.
 */
export default function NumberField({
  id,
  label,
  unit,
  placeholder,
  hint,
  error,
  registration,
}: NumberFieldProps) {
  const { ref, ...field } = registration
  const helpId = `${id}-help`

  return (
    <FormControl fullWidth error={error !== undefined}>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <OutlinedInput
        id={id}
        placeholder={placeholder}
        inputRef={ref}
        {...field}
        endAdornment={<InputAdornment position="end">{unit}</InputAdornment>}
        slotProps={{
          input: {
            inputMode: 'decimal',
            autoComplete: 'off',
            'aria-describedby': helpId,
          },
        }}
      />
      <FormHelperText id={helpId}>{error ?? hint}</FormHelperText>
    </FormControl>
  )
}
