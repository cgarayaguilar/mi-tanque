import type { HTMLAttributes, ReactNode } from 'react'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import InputAdornment from '@mui/material/InputAdornment'
import OutlinedInput from '@mui/material/OutlinedInput'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { space } from 'theme/tokens'

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
  /** Id of a <datalist> with suggestions (free text still allowed). */
  list?: string
  /** Next to the label, e.g. the ⓘ of a measure (specs/0013 RF-4). */
  help?: ReactNode
  /** Less inner padding, for three fields on a phone's row (specs/0013). */
  dense?: boolean
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
  list,
  help,
  dense = false,
}: TextFieldProps) {
  const { ref, ...field } = registration
  const helpId = `${id}-help`
  const message = error ?? hint

  return (
    <FormControl fullWidth error={error !== undefined} disabled={disabled}>
      {help === undefined ? (
        <FormLabel htmlFor={id}>{label}</FormLabel>
      ) : (
        // The label's own bottom margin, on the row with its help
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mb: `${String(space.xs)}px`,
          }}
        >
          <FormLabel htmlFor={id} sx={{ mb: 0 }}>
            {label}
          </FormLabel>
          {help}
        </Box>
      )}
      <OutlinedInput
        id={id}
        type={type}
        placeholder={placeholder}
        inputRef={ref}
        {...field}
        sx={
          dense
            ? {
                pl: 0,
                pr: 2,
                '& .MuiInputBase-input': { pl: 2 },
                '& .MuiInputAdornment-positionEnd': { ml: 1 },
              }
            : undefined
        }
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
            list,
            'aria-describedby': message === undefined ? undefined : helpId,
          },
        }}
      />
      {message !== undefined && (
        <FormHelperText id={helpId}>{message}</FormHelperText>
      )}
    </FormControl>
  )
}
