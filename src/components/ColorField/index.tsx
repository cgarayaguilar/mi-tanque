import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import ColorDot from 'components/ColorDot'
import TextField from 'components/TextField'
import { COLOR_SWATCHES, type Swatch } from 'schemas/fleet'
import type { UseFormRegisterReturn } from 'react-hook-form'

interface ColorFieldProps<T extends FieldValues> {
  control: Control<T>
  swatchName: FieldPath<T>
  otherRegistration: UseFormRegisterReturn
  otherError?: string | undefined
  disabled?: boolean
}

const OPTIONS: { id: Swatch | ''; label: string }[] = [
  { id: '', label: 'Sin color' },
  ...COLOR_SWATCHES,
  { id: 'other', label: 'Otro' },
]

/**
 * Color from a palette, or written in (specs/0003): chips with their dot in a
 * radio group, and a text field when "Otro" is chosen.
 */
export default function ColorField<T extends FieldValues>({
  control,
  swatchName,
  otherRegistration,
  otherError,
  disabled = false,
}: ColorFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={swatchName}
      render={({ field }) => (
        <FormControl component="fieldset" fullWidth disabled={disabled}>
          <FormLabel component="legend">Color</FormLabel>
          <Box
            role="radiogroup"
            aria-label="Color"
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}
          >
            {OPTIONS.map(option => {
              const selected = field.value === option.id
              return (
                <Chip
                  key={option.id || 'none'}
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  label={option.label}
                  icon={
                    option.id === '' ? undefined : (
                      <Box component="span" sx={{ display: 'flex', pl: 1 }}>
                        <ColorDot swatch={option.id} size={14} />
                      </Box>
                    )
                  }
                  variant={selected ? 'filled' : 'outlined'}
                  color={selected ? 'primary' : 'default'}
                  onClick={() => {
                    field.onChange(option.id)
                  }}
                />
              )
            })}
          </Box>
          {field.value === 'other' && (
            <Box sx={{ mt: 3 }}>
              <TextField
                id="colorOther"
                label="¿Qué color?"
                placeholder="Rojo vino"
                error={otherError}
                registration={otherRegistration}
                disabled={disabled}
              />
            </Box>
          )}
        </FormControl>
      )}
    />
  )
}
