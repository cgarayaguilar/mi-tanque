import { useRef, useState } from 'react'
import { useForkRef } from '@mui/material/utils'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
// MUI X v7 (the version the license covers): this adapter is for date-fns 2
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
// The desktop picker everywhere: the field can be typed in, also on a phone
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker'
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
import { fromPlainDate, toPlainDate } from 'utils/plainDate'

// Spanish texts; the locale marks every key optional, the provider wants
// the ones it has
const localeText = Object.fromEntries(
  Object.entries(
    esES.components.MuiLocalizationProvider.defaultProps.localeText
  ).filter(([, text]) => text !== undefined)
) as PickersInputLocaleText<Date>

// The range the rules accept (backend specs/0011 RF-2)
const MIN_DATE = new Date(2000, 0, 1)
const MAX_DATE = new Date(2100, 11, 31)

interface DateFieldProps<T extends FieldValues> {
  id: string
  label: string
  control: Control<T>
  /** A form value '' or 'YYYY-MM-DD' (utils/plainDate). */
  name: FieldPath<T>
  hint?: string
  error?: string | undefined
  disabled?: boolean
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
}

// What is being typed is kept here: a half-written date is not a form value
// yet, and giving the picker null would erase it
function Picker({
  id,
  value,
  onChange,
  onBlur,
  inputRef,
  helpId,
  error,
  disabled,
}: PickerProps) {
  const [draft, setDraft] = useState<Date | null>(() => fromPlainDate(value))
  const input = useRef<HTMLInputElement>(null)
  const clearing = useRef(false)
  const ref = useForkRef(inputRef, input)
  return (
    <DesktopDatePicker
      value={draft}
      format="dd/MM/yyyy"
      minDate={MIN_DATE}
      maxDate={MAX_DATE}
      disabled={disabled}
      inputRef={ref}
      onChange={date => {
        setDraft(date)
        // A pasted date the picker cannot read comes as empty: with digits
        // still in the field it is a mistake, not a cleared date (audit
        // 2026-10-02)
        const typed = !clearing.current && /\d/.test(input.current?.value ?? '')
        clearing.current = false
        onChange(
          date === null
            ? typed
              ? 'invalid'
              : ''
            : isValid(date)
              ? toPlainDate(date)
              : 'invalid'
        )
      }}
      slotProps={{
        field: {
          clearable: true,
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
 * A calendar date with Material's picker, in Spanish (backend specs/0011
 * RF-3): typed as dd/mm/aaaa or chosen in the calendar, and clearable.
 */
export default function DateField<T extends FieldValues>({
  id,
  label,
  control,
  name,
  hint,
  error,
  disabled = false,
}: DateFieldProps<T>) {
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
