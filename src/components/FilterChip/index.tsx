import { useId, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import OutlinedInput from '@mui/material/OutlinedInput'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import { radius, space } from 'theme/tokens'
import { foldText } from 'utils/foldText'

export interface FilterOption<T> {
  value: T
  label: string
}

/** Lists longer than this bring a search field (backend specs/0017 RF-5). */
export const SEARCH_FROM = 10

// The height of Material's Chip, so filters line up with the other chips
const CHIP_HEIGHT = space.xl

/** The chips of a list, side by side, wrapping instead of sliding (RF-6). */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Box
      role="group"
      aria-label="Filtros"
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, minWidth: 0 }}
    >
      {children}
    </Box>
  )
}

/**
 * A filter as one chip (backend specs/0017): "Capacidad ▾" until a value is
 * chosen, then the value, filled, with a × that takes it away. The chip opens
 * a menu with the options, and long ones bring a search field.
 */
export default function FilterChip<T extends string | number>({
  label,
  allLabel,
  options,
  value,
  onChange,
  named = false,
  clearLabel,
}: {
  /** The filter's name: "Marca". */
  label: string
  /** The option without a filter: "Todas". */
  allLabel: string
  options: readonly FilterOption<T>[]
  value: T | null
  onChange: (value: T | null) => void
  /**
   * Chosen, it says its name too: "Agrupar: Camión", where the value alone
   * could be read as a filter (backend specs/0030 RF-3).
   */
  named?: boolean
  /** The ×'s name; "Quitar filtro Marca" by default. */
  clearLabel?: string
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [search, setSearch] = useState('')
  const menuId = useId()
  const chosen =
    value === null
      ? null
      : (options.find(option => option.value === value)?.label ?? String(value))
  const searchable = options.length > SEARCH_FROM
  const typed = foldText(search.trim())
  const shown =
    searchable && typed !== ''
      ? options.filter(option => foldText(option.label).includes(typed))
      : options

  const close = () => {
    setAnchor(null)
    setSearch('')
  }
  const pick = (next: T | null) => {
    close()
    if (next !== value) onChange(next)
  }

  return (
    <>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          maxWidth: '100%',
          height: CHIP_HEIGHT,
          borderRadius: `${String(radius.pill)}px`,
          border: 1,
          borderColor: chosen === null ? 'divider' : 'primary.main',
          bgcolor: chosen === null ? 'transparent' : 'primary.main',
          color: chosen === null ? 'text.primary' : 'primary.contrastText',
        }}
      >
        <ButtonBase
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          aria-controls={anchor === null ? undefined : menuId}
          aria-label={chosen === null ? label : `${label}: ${chosen}`}
          onClick={event => {
            setAnchor(event.currentTarget.parentElement)
          }}
          sx={{
            height: '100%',
            minWidth: 0,
            pl: 3,
            // The arrow brings its own air: two lines fit a phone (RNF-1)
            pr: 1,
            gap: 0.5,
            borderRadius: `${String(radius.pill)}px`,
            typography: 'body2',
            // body2 brings its own grey: the chip's color wins
            color: 'inherit',
          }}
        >
          <Box
            component="span"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {chosen === null ? label : named ? `${label}: ${chosen}` : chosen}
          </Box>
          {chosen === null && <ArrowDropDownIcon fontSize="small" />}
        </ButtonBase>
        {chosen !== null && (
          <IconButton
            size="small"
            aria-label={clearLabel ?? `Quitar filtro ${label}`}
            onClick={() => {
              onChange(null)
            }}
            sx={{ color: 'inherit', mr: 1, p: 0.5 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        slotProps={{
          paper: { sx: { maxHeight: '60vh' } },
          list: { 'aria-label': label, sx: { pt: searchable ? 0 : 1 } },
        }}
      >
        {searchable && (
          // Sticky above the list; it keeps its keys, except the ones that
          // move through the menu or close it (RF-4)
          <ListSubheader sx={{ bgcolor: 'background.paper', pt: 2, pb: 1 }}>
            <OutlinedInput
              size="small"
              fullWidth
              type="search"
              placeholder={`Buscar ${label.toLowerCase()}`}
              value={search}
              onChange={event => {
                setSearch(event.target.value)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' && shown[0]) {
                  event.preventDefault()
                  pick(shown[0].value)
                  return
                }
                if (!['ArrowDown', 'ArrowUp', 'Escape'].includes(event.key)) {
                  event.stopPropagation()
                }
              }}
              startAdornment={
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              }
              slotProps={{
                input: {
                  'aria-label': `Buscar ${label.toLowerCase()}`,
                  autoComplete: 'off',
                },
              }}
            />
          </ListSubheader>
        )}
        {typed === '' &&
          filterMenuItem('all', allLabel, value === null, () => {
            pick(null)
          })}
        {shown.map(option =>
          filterMenuItem(
            String(option.value),
            option.label,
            option.value === value,
            () => {
              pick(option.value)
            }
          )
        )}
        {shown.length === 0 && <MenuItem disabled>Sin resultados</MenuItem>}
      </Menu>
    </>
  )
}

// A function, not a component: MenuList reads `selected` and hands
// `autoFocus` to its own children, so they must be MenuItems
const filterMenuItem = (
  key: string,
  label: string,
  checked: boolean,
  onClick: () => void
) => (
  <MenuItem
    key={key}
    role="menuitemradio"
    aria-checked={checked}
    selected={checked}
    onClick={onClick}
  >
    <ListItemIcon>{checked && <CheckIcon fontSize="small" />}</ListItemIcon>
    {label}
  </MenuItem>
)

/**
 * A filter that is on or off, with no menu: "Archivados" (specs/0017 RF-10).
 */
export function FilterToggle({
  label,
  on,
  onChange,
}: {
  label: string
  on: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <Chip
      label={label}
      clickable
      aria-pressed={on}
      variant={on ? 'filled' : 'outlined'}
      color={on ? 'primary' : 'default'}
      icon={on ? <CheckIcon /> : undefined}
      onClick={() => {
        onChange(!on)
      }}
      // The same letter as the other filters, in the chip's own color
      sx={{ '& .MuiChip-label': { typography: 'body2', color: 'inherit' } }}
    />
  )
}
