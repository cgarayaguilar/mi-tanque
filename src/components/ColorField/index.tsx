import type {
  Control,
  FieldPath,
  FieldValues,
  UseFormRegisterReturn,
} from 'react-hook-form'
import Stack from '@mui/material/Stack'
import AutocompleteField from 'components/AutocompleteField'
import ColorDot from 'components/ColorDot'
import TextField from 'components/TextField'
import { COLOR_SWATCHES, FLEET_LIMITS, type Swatch } from 'schemas/fleet'

interface ColorFieldProps<T extends FieldValues> {
  control: Control<T>
  swatchName: FieldPath<T>
  /** Whether "Otro" is chosen: then the color is written in. */
  isOther: boolean
  otherRegistration: UseFormRegisterReturn
  otherError?: string | undefined
  disabled?: boolean
  /** Before its ids: two forms on one page (a trailer and its truck). */
  idPrefix?: string
}

const OPTIONS = [
  { value: '', label: 'Sin color' },
  ...COLOR_SWATCHES.map(swatch => ({ value: swatch.id, label: swatch.label })),
  { value: 'other', label: 'Otro' },
]

/**
 * A vehicle's color (specs/0003): a list with each color's dot and search,
 * and a text field when "Otro" is chosen (backend specs/0009 RF-3).
 */
export default function ColorField<T extends FieldValues>({
  control,
  swatchName,
  isOther,
  otherRegistration,
  otherError,
  disabled = false,
  idPrefix = '',
}: ColorFieldProps<T>) {
  return (
    <Stack spacing={3}>
      <AutocompleteField
        id={`${idPrefix}colorSwatch`}
        label="Color (opcional)"
        options={OPTIONS}
        control={control}
        name={swatchName}
        disabled={disabled}
        decoration={value =>
          value === '' ? null : <ColorDot swatch={value as Swatch} size={14} />
        }
      />
      {isOther && (
        <TextField
          id={`${idPrefix}colorOther`}
          label="¿Qué color?"
          placeholder="Rojo vino"
          maxLength={FLEET_LIMITS.colorLabel}
          error={otherError}
          registration={otherRegistration}
          disabled={disabled}
        />
      )}
    </Stack>
  )
}
