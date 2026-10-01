import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import NativeSelect from '@mui/material/NativeSelect'
import OutlinedInput from '@mui/material/OutlinedInput'
import type { UseFormRegisterReturn } from 'react-hook-form'

export interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps {
  id: string
  label: string
  options: readonly SelectOption[]
  hint?: string
  error?: string | undefined
  registration: UseFormRegisterReturn
  disabled?: boolean
}

/**
 * A native select: on a phone it opens the system picker, which is easier
 * one-handed than a menu (DESIGN.md, Campo de selección).
 */
export default function SelectField({
  id,
  label,
  options,
  hint,
  error,
  registration,
  disabled = false,
}: SelectFieldProps) {
  const { ref, ...field } = registration
  const helpId = `${id}-help`
  const help = error ?? hint

  return (
    <FormControl fullWidth error={error !== undefined} disabled={disabled}>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <NativeSelect
        input={<OutlinedInput />}
        inputRef={ref}
        {...field}
        inputProps={{
          id,
          'aria-describedby': help === undefined ? undefined : helpId,
        }}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      {help !== undefined && (
        <FormHelperText id={helpId}>{help}</FormHelperText>
      )}
    </FormControl>
  )
}
