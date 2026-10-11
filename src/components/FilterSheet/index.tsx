import { useId, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import TuneIcon from '@mui/icons-material/Tune'
import { AutocompleteBase } from 'components/AutocompleteField'
import { ChoiceButtonsBase } from 'components/ChoiceButtons'
import { CHIP_HEIGHT, type FilterOption } from 'components/FilterChip'
import { radius, space } from 'theme/tokens'

// The filters of a list in a sheet from below (backend specs/0039): one
// button in sight, every filter inside

/** Buttons up to this many options, "Todos" included (specs/0009 RF-2). */
const BUTTONS_UP_TO = 3

export interface SheetFilter {
  label: string
  /** The option without a filter: "Todos". Without it, one is always on. */
  allLabel?: string
  options: readonly FilterOption<string>[]
  value: string | null
  onChange: (value: string | null) => void
  /** Without `allLabel`, the value that filters nothing (RF-6). */
  defaultValue?: string
}

/**
 * A filter of some values: what is chosen in the sheet is always one of its
 * options, so a screen keeps its own types.
 */
export const sheetFilter = <T extends string>(filter: {
  label: string
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

/** Whether a filter narrows the list (RF-2). */
const isActive = (filter: SheetFilter) =>
  filter.value !== null && filter.value !== filter.defaultValue

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
  return !grouped && options.length <= BUTTONS_UP_TO ? (
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
    />
  )
}

interface FilterSheetProps {
  /** The filters that apply now, in order (RF-4). */
  filters: readonly SheetFilter[]
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
        anchor="bottom"
        open={open}
        onClose={close}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-labelledby': titleId,
            sx: {
              maxHeight: '85dvh',
              display: 'flex',
              flexDirection: 'column',
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
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
          sx={{ px: 4, py: 2, overflowY: 'auto', flexGrow: 1 }}
        >
          {filters.map((filter, index) => (
            <FilterField
              key={filter.label}
              filter={filter}
              id={`${fieldId}-${String(index)}`}
            />
          ))}
        </Stack>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            px: 4,
            pt: 3,
            pb: `calc(${String(space.base)}px + env(safe-area-inset-bottom))`,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Button
            disabled={active === 0}
            onClick={() => {
              for (const filter of filters)
                if (isActive(filter))
                  filter.onChange(filter.defaultValue ?? null)
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
