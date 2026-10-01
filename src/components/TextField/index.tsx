import type { HTMLAttributes, ReactNode } from 'react'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import InputAdornment from '@mui/material/InputAdornment'
import OutlinedInput from '@mui/material/OutlinedInput'
import type { UseFormRegisterReturn } from 'react-hook-form'

export interface TextFieldProps {
  id: string
  label: string
  placeholder?: string
  /** Shown under the field until there is an error. */
  hint?: string
  error?: string | undefined
  registration: UseFormRegisterReturn
  type?: 'text' | 'tel'
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  maxLength?: number
  /** Short text inside the field, at the start (e.g. "+505") or the end. */
  startAdornment?: ReactNode
  endAdornment?: ReactNode
  disabled?: boolean
}

/**
 * Text input for React Hook Form (§8.7): visible label and one line under the
 * field that shows the hint or the error, announced with the field.
 */
export default function TextField({
  id,
  label,
  placeholder,
  hint,
  error,
  registration,
  type = 'text',
  inputMode,
  autoComplete = 'off',
  maxLength,
  startAdornment,
  endAdornment,
  disabled = false,
}: TextFieldProps) {
  const { ref, ...field } = registration
  const helpId = `${id}-help`
  const help = error ?? hint

  return (
    <FormControl fullWidth error={error !== undefined} disabled={disabled}>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <OutlinedInput
        id={id}
        type={type}
        placeholder={placeholder}
        inputRef={ref}
        {...field}
        startAdornment={
          startAdornment !== undefined && (
            <InputAdornment position="start">{startAdornment}</InputAdornment>
          )
        }
        endAdornment={
          endAdornment !== undefined && (
            <InputAdornment position="end">{endAdornment}</InputAdornment>
          )
        }
        slotProps={{
          input: {
            inputMode,
            autoComplete,
            maxLength,
            'aria-describedby': help === undefined ? undefined : helpId,
          },
        }}
      />
      {help !== undefined && (
        <FormHelperText id={helpId}>{help}</FormHelperText>
      )}
    </FormControl>
  )
}
