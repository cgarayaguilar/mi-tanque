import type { Ref } from 'react'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { Controller, type FieldValues } from 'react-hook-form'
import type { ChoiceFieldProps, SelectOption } from 'components/SelectField'
import { typeScale } from 'theme/tokens'

interface ChoiceButtonsBaseProps {
  id: string
  label: string
  options: readonly SelectOption[]
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  hint?: string | undefined
  error?: string | undefined
  disabled?: boolean
  /** Given to the first button, so a failed save can focus the choice. */
  firstRef?: Ref<HTMLButtonElement>
  /** Smaller text, for a narrow column beside a field (specs/0012 RF-6). */
  compact?: boolean
}

/**
 * Two or three choices side by side: one tap, no menu (backend specs/0009
 * RF-1). The chosen one is filled; each button says whether it is pressed.
 * For a choice that is not a form value (e.g. how a tank is described).
 */
export function ChoiceButtonsBase({
  id,
  label,
  options,
  value,
  onChange,
  onBlur,
  hint,
  error,
  disabled = false,
  firstRef,
  compact = false,
}: ChoiceButtonsBaseProps) {
  const labelId = `${id}-label`
  const helpId = `${id}-help`
  const help = error ?? hint
  return (
    <FormControl fullWidth error={error !== undefined} disabled={disabled}>
      <FormLabel id={labelId}>{label}</FormLabel>
      <ToggleButtonGroup
        id={id}
        exclusive
        fullWidth
        value={value}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={help === undefined ? undefined : helpId}
        onBlur={onBlur}
        onChange={(_, next: string | null) => {
          // Tapping the chosen one again keeps it
          if (next !== null) onChange(next)
        }}
      >
        {options.map((option, index) => (
          <ToggleButton
            key={option.value}
            value={option.value}
            ref={index === 0 ? firstRef : undefined}
            sx={
              compact
                ? { ...typeScale.caption, fontWeight: 500, px: 1 }
                : undefined
            }
          >
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {help !== undefined && (
        <FormHelperText id={helpId}>{help}</FormHelperText>
      )}
    </FormControl>
  )
}

/** The same, bound to a form field (React Hook Form). */
export default function ChoiceButtons<T extends FieldValues>({
  control,
  name,
  onChange,
  disabled = false,
  ...props
}: ChoiceFieldProps<T> & { compact?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ChoiceButtonsBase
          {...props}
          value={field.value}
          disabled={disabled || field.disabled === true}
          firstRef={field.ref}
          onBlur={field.onBlur}
          onChange={value => {
            field.onChange(value)
            onChange?.(value)
          }}
        />
      )}
    />
  )
}
