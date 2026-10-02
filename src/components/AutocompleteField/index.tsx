import type { ReactNode, Ref } from 'react'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import InputAdornment from '@mui/material/InputAdornment'
import OutlinedInput from '@mui/material/OutlinedInput'
import { Controller, type FieldValues } from 'react-hook-form'
import type { ChoiceFieldProps, SelectOption } from 'components/SelectField'

interface AutocompleteBaseProps {
  id: string
  label: string
  options: readonly SelectOption[]
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  hint?: string | undefined
  error?: string | undefined
  disabled?: boolean
  placeholder?: string | undefined
  /** Drawn before each option and before the chosen one (e.g. a color dot). */
  decoration?: ((value: string) => ReactNode) | undefined
  /** The input, so a failed save can focus it. */
  inputRef?: Ref<HTMLInputElement>
}

// Stable: a new function each render makes the Autocomplete put the chosen
// label back over what is being typed
const labelOf = (option: SelectOption) => option.label
// By value: two options may read the same (two "Flota de Juan")
const keyOf = (option: SelectOption) => option.value
const sameOption = (option: SelectOption, chosen: SelectOption) =>
  option.value === chosen.value
// The label and its keywords, ignoring case and accents
const filterOptions = createFilterOptions<SelectOption>({
  stringify: option => `${option.label} ${option.keywords ?? ''}`,
})

/**
 * A long or growing list with search (countries, currencies, colors,
 * trucks, members): Material's list under the field (backend specs/0009
 * RF-1, RF-2). Only the options can be chosen; an optional field has its own
 * "none" option, so the field is never left empty by mistake. For a choice
 * that is not a form value (e.g. a filter).
 */
export function AutocompleteBase({
  id,
  label,
  options,
  value,
  onChange,
  onBlur,
  hint,
  error,
  disabled = false,
  placeholder,
  decoration,
  inputRef,
}: AutocompleteBaseProps) {
  const helpId = `${id}-help`
  const help = error ?? hint
  const selected = options.find(option => option.value === value) ?? null
  const start = selected ? decoration?.(selected.value) : null

  return (
    <FormControl fullWidth error={error !== undefined} disabled={disabled}>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <Autocomplete<SelectOption, false, true>
        id={id}
        options={options}
        // No selection yet (e.g. a currency to choose): an empty field
        value={selected as SelectOption}
        disableClearable
        disabled={disabled}
        getOptionLabel={labelOf}
        getOptionKey={keyOf}
        isOptionEqualToValue={sameOption}
        filterOptions={filterOptions}
        // Typing "hond" and Enter picks the only match, as people expect
        autoHighlight
        noOptionsText="Sin resultados"
        openText="Abrir"
        closeText="Cerrar"
        onBlur={onBlur}
        onChange={(_, option) => {
          onChange(option.value)
        }}
        renderOption={({ key, ...props }, option) => (
          <Box component="li" key={key} {...props} sx={{ gap: 2 }}>
            {decoration?.(option.value)}
            {option.label}
          </Box>
        )}
        renderInput={params => (
          <OutlinedInput
            {...params.InputProps}
            disabled={params.disabled}
            fullWidth
            placeholder={placeholder}
            startAdornment={
              start ? (
                <InputAdornment position="start">{start}</InputAdornment>
              ) : null
            }
            // InputBase joins it with the Autocomplete's own ref
            inputRef={inputRef}
            inputProps={{
              ...params.inputProps,
              id,
              'aria-describedby': help === undefined ? undefined : helpId,
            }}
          />
        )}
      />
      {help !== undefined && (
        <FormHelperText id={helpId}>{help}</FormHelperText>
      )}
    </FormControl>
  )
}

interface AutocompleteFieldProps<
  T extends FieldValues,
> extends ChoiceFieldProps<T> {
  placeholder?: string
  decoration?: (value: string) => ReactNode
}

/** The same, bound to a form field (React Hook Form). */
export default function AutocompleteField<T extends FieldValues>({
  control,
  name,
  onChange,
  disabled = false,
  ...props
}: AutocompleteFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <AutocompleteBase
          {...props}
          value={field.value}
          disabled={disabled || field.disabled === true}
          inputRef={field.ref}
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
