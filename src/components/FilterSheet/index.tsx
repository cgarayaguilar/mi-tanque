import { useId, useState } from 'react'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Checkbox from '@mui/material/Checkbox'
import Drawer from '@mui/material/Drawer'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import OutlinedInput from '@mui/material/OutlinedInput'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import CloseIcon from '@mui/icons-material/Close'
import TuneIcon from '@mui/icons-material/Tune'
import { AutocompleteBase } from 'components/AutocompleteField'
import { ChoiceButtonsBase } from 'components/ChoiceButtons'
import { CHIP_HEIGHT, type FilterOption } from 'components/FilterChip'
import { radius, space } from 'theme/tokens'
import {
  AMOUNT_OP_LABELS,
  AMOUNT_OPS,
  ANY_AMOUNT,
  amountIssues,
  amountMatcher,
  amountText,
  type AmountQuery,
} from 'utils/amountQuery'

// The filters of a list in a sheet from below (backend specs/0039): one
// button in sight, every filter inside

/** The side sheet on a wider screen (specs/0039 RF-3). */
const SIDE_WIDTH = 350

/** Buttons up to this many options, "Todos" included (specs/0009 RF-2). */
const BUTTONS_UP_TO = 3

export interface SheetFilter {
  kind?: 'one'
  label: string
  /**
   * A list that can grow (clients, trucks, drivers): always a list with
   * search, however few it has now (specs/0039 RF-4)
   */
  list?: boolean
  /** The option without a filter: "Todos". Without it, one is always on. */
  allLabel?: string
  options: readonly FilterOption<string>[]
  value: string | null
  onChange: (value: string | null) => void
  /** Without `allLabel`, the value that filters nothing (RF-6). */
  defaultValue?: string
  /** Under the field: why it filters less than it says (specs/0043 RF-5). */
  hint?: string | undefined
}

/**
 * Several values of a growing list (specs/0043 RF-1): a list with search
 * where they are checked; none filters nothing.
 */
export interface ManySheetFilter {
  kind: 'many'
  label: string
  /** Shown when none is chosen: "Todas". */
  allLabel: string
  options: readonly FilterOption<string>[]
  values: readonly string[]
  onChange: (values: string[]) => void
}

/** An amount: a condition and one or two amounts (specs/0043 RF-7). */
export interface AmountSheetFilter {
  kind: 'amount'
  label: string
  /** The organization's currency symbol, in the fields: "C$". */
  symbol: string
  /** "C$1,000.00 NIO": an amount as the active filter says it. */
  money: (amount: number) => string
  value: AmountQuery
  onChange: (value: AmountQuery) => void
}

export type AnySheetFilter = SheetFilter | ManySheetFilter | AmountSheetFilter

/**
 * A filter of some values: what is chosen in the sheet is always one of its
 * options, so a screen keeps its own types.
 */
export const sheetFilter = <T extends string>(filter: {
  label: string
  list?: boolean
  allLabel?: string
  options: readonly FilterOption<T>[]
  value: T | null
  onChange: (value: T | null) => void
  defaultValue?: T
}): SheetFilter => ({
  ...filter,
  onChange: value => {
    filter.onChange(
      value === null
        ? null
        : (filter.options.find(option => option.value === value)?.value ?? null)
    )
  },
})

/**
 * Whether a filter narrows the list (RF-2): several values count as one
 * (specs/0043 RF-8), and an amount only once it is valid.
 */
export const isActive = (filter: AnySheetFilter) => {
  switch (filter.kind) {
    case 'many':
      return filter.values.length > 0
    case 'amount':
      return amountMatcher(filter.value) !== null
    default:
      return filter.value !== null && filter.value !== filter.defaultValue
  }
}

/** "Cliente: Walmart", one per filter on: what a report says (specs/0040). */
export const appliedFilters = (filters: readonly AnySheetFilter[]) =>
  filters.filter(isActive).map(filter => {
    switch (filter.kind) {
      case 'many':
        return `${filter.label}: ${filter.options
          .filter(option => filter.values.includes(option.value))
          .map(option => option.label)
          .join(', ')}`
      case 'amount':
        return `${filter.label}: ${amountText(filter.value, filter.money) ?? ''}`
      default:
        return `${filter.label}: ${
          filter.options.find(option => option.value === filter.value)?.label ??
          String(filter.value)
        }`
    }
  })

/** A filter as it was before any was chosen. */
const cleared = (filter: AnySheetFilter) => {
  switch (filter.kind) {
    case 'many':
      filter.onChange([])
      return
    case 'amount':
      filter.onChange(ANY_AMOUNT)
      return
    default:
      filter.onChange(filter.defaultValue ?? null)
  }
}

// The "Todos" option of a field: '' is no filter
const ALL = ''

function FilterField({ filter, id }: { filter: SheetFilter; id: string }) {
  const options = [
    ...(filter.allLabel === undefined
      ? []
      : [{ value: ALL, label: filter.allLabel }]),
    ...filter.options,
  ]
  const value = filter.value ?? ALL
  const change = (next: string) => {
    const chosen = next === ALL ? null : next
    if (chosen !== filter.value) filter.onChange(chosen)
  }
  // Grouped options keep their subtitles: always a list (specs/0033 RF-1)
  const grouped = filter.options.some(option => option.group !== undefined)
  return !filter.list && !grouped && options.length <= BUTTONS_UP_TO ? (
    <ChoiceButtonsBase
      id={id}
      label={filter.label}
      options={options}
      value={value}
      onChange={change}
    />
  ) : (
    <AutocompleteBase
      id={id}
      label={filter.label}
      options={options}
      value={value}
      onChange={change}
      hint={filter.hint}
    />
  )
}

type ManyOption = FilterOption<string>
const searchMany = createFilterOptions<ManyOption>({
  stringify: option => option.label,
})

/** Several values, checked in a list with search (specs/0043 RF-1). */
function ManyField({ filter, id }: { filter: ManySheetFilter; id: string }) {
  const chosen = filter.options.filter(option =>
    filter.values.includes(option.value)
  )
  return (
    <FormControl fullWidth>
      <FormLabel htmlFor={id}>{filter.label}</FormLabel>
      <Autocomplete<ManyOption, true>
        id={id}
        multiple
        disableCloseOnSelect
        options={filter.options}
        value={chosen}
        filterOptions={searchMany}
        getOptionLabel={option => option.label}
        getOptionKey={option => option.value}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        onChange={(_, next) => {
          filter.onChange(next.map(option => option.value))
        }}
        noOptionsText="Sin resultados"
        openText="Abrir"
        closeText="Cerrar"
        clearText="Quitar todas"
        renderOption={({ key, ...props }, option, { selected }) => (
          <Box component="li" key={key} {...props} sx={{ gap: 1 }}>
            <Checkbox
              checked={selected}
              size="small"
              tabIndex={-1}
              disableRipple
              sx={{ p: 0.5 }}
              slotProps={{ input: { 'aria-hidden': true } }}
            />
            {option.label}
          </Box>
        )}
        slotProps={{
          chip: { size: 'small' },
        }}
        renderInput={params => (
          <OutlinedInput
            {...params.InputProps}
            fullWidth
            placeholder={chosen.length === 0 ? filter.allLabel : undefined}
            inputProps={{ ...params.inputProps, id }}
          />
        )}
      />
    </FormControl>
  )
}

/** One amount typed in the sheet, with the currency's symbol. */
function AmountInput({
  id,
  label,
  symbol,
  value,
  error,
  onChange,
}: {
  id: string
  label: string
  symbol: string
  value: string
  error: string | undefined
  onChange: (value: string) => void
}) {
  const helpId = `${id}-help`
  return (
    <FormControl fullWidth error={error !== undefined}>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <OutlinedInput
        id={id}
        value={value}
        placeholder="0.00"
        onChange={event => {
          onChange(event.target.value)
        }}
        startAdornment={
          <InputAdornment position="start">{symbol}</InputAdornment>
        }
        slotProps={{
          input: {
            inputMode: 'decimal',
            autoComplete: 'off',
            'aria-describedby': error === undefined ? undefined : helpId,
          },
        }}
      />
      {error !== undefined && (
        <FormHelperText id={helpId}>{error}</FormHelperText>
      )}
    </FormControl>
  )
}

/**
 * "Monto": a condition from Material's menu, then one amount, or "Desde"
 * and "Hasta" (specs/0043 RF-7). A wrong amount says so and filters
 * nothing.
 */
function AmountField({
  filter,
  id,
}: {
  filter: AmountSheetFilter
  id: string
}) {
  const { value } = filter
  const issues = amountIssues(value)
  const labelId = `${id}-label`
  const change = (next: Partial<AmountQuery>) => {
    filter.onChange({ ...value, ...next })
  }
  return (
    <Box role="group" aria-labelledby={labelId}>
      {/* Drawn as every field's label: it names the group */}
      <FormLabel id={labelId} component="p">
        {filter.label}
      </FormLabel>
      <Stack spacing={3}>
        <Select
          id={`${id}-op`}
          value={value.op}
          input={<OutlinedInput />}
          inputProps={{ 'aria-label': 'Condición' }}
          SelectDisplayProps={{ 'aria-label': 'Condición' }}
          onChange={event => {
            const op = event.target.value
            change(op === 'any' ? ANY_AMOUNT : { op })
          }}
        >
          {AMOUNT_OPS.map(op => (
            <MenuItem key={op} value={op}>
              {AMOUNT_OP_LABELS[op]}
            </MenuItem>
          ))}
        </Select>
        {value.op === 'between' ? (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <AmountInput
              id={`${id}-from`}
              label="Desde"
              symbol={filter.symbol}
              value={value.from}
              error={issues.from}
              onChange={from => {
                change({ from })
              }}
            />
            <AmountInput
              id={`${id}-to`}
              label="Hasta"
              symbol={filter.symbol}
              value={value.to}
              error={issues.to}
              onChange={to => {
                change({ to })
              }}
            />
          </Box>
        ) : (
          value.op !== 'any' && (
            <AmountInput
              id={`${id}-from`}
              label="Monto"
              symbol={filter.symbol}
              value={value.from}
              error={issues.from}
              onChange={from => {
                change({ from })
              }}
            />
          )
        )}
      </Stack>
    </Box>
  )
}

function AnyFilterField({
  filter,
  id,
}: {
  filter: AnySheetFilter
  id: string
}) {
  switch (filter.kind) {
    case 'many':
      return <ManyField filter={filter} id={id} />
    case 'amount':
      return <AmountField filter={filter} id={id} />
    default:
      return <FilterField filter={filter} id={id} />
  }
}

interface FilterSheetProps {
  /** The filters that apply now, in order (RF-4). */
  filters: readonly AnySheetFilter[]
  /** "Ver 12 viajes": what is left with the filters on (RF-3). */
  resultLabel: string
}

/**
 * "Filtros" and its sheet from below (backend specs/0039): the button says
 * how many filters are on, and each one applies as it is chosen (RF-5).
 */
export default function FilterSheet({
  filters,
  resultLabel,
}: FilterSheetProps) {
  const [open, setOpen] = useState(false)
  // From below on a phone; on a wider screen, from the right (RF-3)
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const titleId = useId()
  const fieldId = useId()
  const active = filters.filter(isActive).length
  const close = () => {
    setOpen(false)
  }

  return (
    <>
      {/* Drawn as the chips beside it: "Agrupar", "Ordenar" (RF-1, RF-2) */}
      <ButtonBase
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          active === 0
            ? 'Filtros'
            : `Filtros, ${String(active)} ${active === 1 ? 'activo' : 'activos'}`
        }
        onClick={() => {
          setOpen(true)
        }}
        sx={{
          height: CHIP_HEIGHT,
          px: 3,
          gap: 1,
          borderRadius: `${String(radius.pill)}px`,
          border: 1,
          borderColor: active === 0 ? 'divider' : 'primary.main',
          bgcolor: active === 0 ? 'transparent' : 'primary.main',
          // body2 brings its own grey: the chip's color wins, as in FilterChip
          typography: 'body2',
          color: active === 0 ? 'text.primary' : 'primary.contrastText',
        }}
      >
        <TuneIcon fontSize="small" />
        <Box component="span" sx={{ color: 'inherit', whiteSpace: 'nowrap' }}>
          {active === 0 ? 'Filtros' : `Filtros · ${String(active)}`}
        </Box>
      </ButtonBase>

      <Drawer
        anchor={phone ? 'bottom' : 'right'}
        open={open}
        onClose={close}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-labelledby': titleId,
            sx: {
              display: 'flex',
              flexDirection: 'column',
              // Its fields scroll between a fixed title and fixed buttons
              overflow: 'hidden',
              ...(phone
                ? {
                    maxHeight: '85dvh',
                    borderTopLeftRadius: radius.xl,
                    borderTopRightRadius: radius.xl,
                  }
                : { width: '100%', maxWidth: SIDE_WIDTH }),
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexShrink: 0,
            px: 4,
            pt: 3,
            pb: 2,
          }}
        >
          <Typography
            id={titleId}
            variant="h3"
            component="h2"
            sx={{ flexGrow: 1 }}
          >
            Filtros
          </Typography>
          <IconButton aria-label="Cerrar filtros" onClick={close}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Stack
          spacing={5}
          sx={{
            px: 4,
            py: 2,
            // Without minHeight 0 a flex child does not shrink, and nothing
            // scrolls: the buttons fell off the screen (owner, 2026-10-11)
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          {filters.map((filter, index) => (
            <AnyFilterField
              key={filter.label}
              filter={filter}
              id={`${fieldId}-${String(index)}`}
            />
          ))}
        </Stack>
        <Box
          sx={{
            display: 'flex',
            flexShrink: 0,
            gap: 2,
            px: 4,
            pt: 3,
            pb: `calc(${String(space.base)}px + env(safe-area-inset-bottom))`,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Button
            disabled={
              active === 0 &&
              !filters.some(
                filter => filter.kind === 'amount' && filter.value.op !== 'any'
              )
            }
            onClick={() => {
              for (const filter of filters) {
                // An amount not yet valid goes too (specs/0043 RF-9)
                if (
                  isActive(filter) ||
                  (filter.kind === 'amount' && filter.value.op !== 'any')
                )
                  cleared(filter)
              }
            }}
          >
            Limpiar filtros
          </Button>
          <Button variant="contained" onClick={close} sx={{ flexGrow: 1 }}>
            {resultLabel}
          </Button>
        </Box>
      </Drawer>
    </>
  )
}
