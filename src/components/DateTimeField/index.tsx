import { useRef, useState } from 'react'
import { useForkRef } from '@mui/material/utils'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
// MUI X v7 (the version the license covers): this adapter is for date-fns 2
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
// The desktop picker everywhere, like DateField: it can be typed in
import { DesktopDateTimePicker } from '@mui/x-date-pickers/DesktopDateTimePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { esES, type PickersInputLocaleText } from '@mui/x-date-pickers/locales'
import { isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RefCallBack,
} from 'react-hook-form'
import { fromDateTimeValue, toDateTimeValue } from 'utils/dateTimeValue'

const localeText = Object.fromEntries(
  Object.entries(
    esES.components.MuiLocalizationProvider.defaultProps.localeText
  ).filter(([, text]) => text !== undefined)
) as PickersInputLocaleText<Date>

// The range the rules accept for a trip (backend specs/0025 RF-1)
const MIN_DATE = new Date(2020, 0, 1)

interface DateTimeFieldProps<T extends FieldValues> {
  id: string
  label: string
  control: Control<T>
  /** A form value '', 'AAAA-MM-DDTHH:mm' or 'invalid'. */
  name: FieldPath<T>
  hint?: string
  error?: string | undefined
  disabled?: boolean
  /** Can be emptied with ×. */
  clearable?: boolean
}

interface PickerProps {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  inputRef: RefCallBack
  helpId: string | undefined
  error: boolean
  disabled: boolean
  clearable: boolean
}

// A half-written date and time stays here, as in DateField
function Picker({
  id,
  value,
  onChange,
  onBlur,
  inputRef,
  helpId,
  error,
  disabled,
  clearable,
}: PickerProps) {
  const [draft, setDraft] = useState<Date | null>(() =>
    fromDateTimeValue(value)
  )
  const input = useRef<HTMLInputElement>(null)
  const clearing = useRef(false)
  const ref = useForkRef(inputRef, input)
  return (
    <DesktopDateTimePicker
      value={draft}
      format="dd/MM/yyyy HH:mm"
      ampm={false}
      minDate={MIN_DATE}
      disabled={disabled}
      inputRef={ref}
      onChange={date => {
        setDraft(date)
        const typed = !clearing.current && /\d/.test(input.current?.value ?? '')
        clearing.current = false
        onChange(
          date === null
            ? typed
              ? 'invalid'
              : ''
            : isValid(date)
              ? toDateTimeValue(date)
              : 'invalid'
        )
      }}
      slotProps={{
        field: {
          clearable,
          onClear: () => {
            clearing.current = true
          },
        },
        textField: {
          id,
          fullWidth: true,
          error,
          onBlur,
          inputProps: { 'aria-describedby': helpId },
        },
      }}
    />
  )
}

/**
 * A date and time with Material's picker, in Spanish, on a 24-hour clock
 * (backend specs/0025 RF-11): typed as dd/mm/aaaa hh:mm or chosen.
 */
export default function DateTimeField<T extends FieldValues>({
  id,
  label,
  control,
  name,
  hint,
  error,
  disabled = false,
  clearable = false,
}: DateTimeFieldProps<T>) {
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
          disabled={disabled || field.disabled === true}
        >
          <FormLabel htmlFor={id}>{label}</FormLabel>
          <LocalizationProvider
            dateAdapter={AdapterDateFns}
            adapterLocale={es}
            localeText={localeText}
          >
            <Picker
              id={id}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              inputRef={field.ref}
              helpId={help === undefined ? undefined : helpId}
              error={error !== undefined}
              disabled={disabled || field.disabled === true}
              clearable={clearable}
            />
          </LocalizationProvider>
          {help !== undefined && (
            <FormHelperText id={helpId}>{help}</FormHelperText>
          )}
        </FormControl>
      )}
    />
  )
}
