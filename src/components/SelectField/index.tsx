import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import MenuItem from '@mui/material/MenuItem'
import OutlinedInput from '@mui/material/OutlinedInput'
import Select from '@mui/material/Select'
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'

export interface SelectOption {
  value: string
  label: string
}

export interface ChoiceFieldProps<T extends FieldValues> {
  id: string
  label: string
  options: readonly SelectOption[]
  control: Control<T>
  name: FieldPath<T>
  hint?: string
  error?: string | undefined
  disabled?: boolean
  /** After the form's value changes (e.g. to fill other fields). */
  onChange?: (value: string) => void
}

/**
 * A short fixed list (4–7 options): Material's menu, the same on every phone,
 * without the keyboard (backend specs/0009 RF-1, DESIGN.md).
 */
export default function SelectField<T extends FieldValues>({
  id,
  label,
  options,
  control,
  name,
  hint,
  error,
  disabled = false,
  onChange,
}: ChoiceFieldProps<T>) {
  const labelId = `${id}-label`
  const helpId = `${id}-help`
  const help = error ?? hint

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormControl
          fullWidth
          error={error !== undefined}
          disabled={disabled || field.disabled}
        >
          <FormLabel id={labelId}>{label}</FormLabel>
          <Select
            id={id}
            labelId={labelId}
            value={field.value ?? ''}
            displayEmpty
            input={<OutlinedInput />}
            inputRef={field.ref}
            onBlur={field.onBlur}
            onChange={event => {
              field.onChange(event.target.value)
              onChange?.(event.target.value)
            }}
            SelectDisplayProps={{
              'aria-describedby': help === undefined ? undefined : helpId,
            }}
          >
            {options.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          {help !== undefined && (
            <FormHelperText id={helpId}>{help}</FormHelperText>
          )}
        </FormControl>
      )}
    />
  )
}
