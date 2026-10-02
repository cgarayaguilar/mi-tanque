import { useDeferredValue, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'
import OutlinedInput from '@mui/material/OutlinedInput'
import Typography from '@mui/material/Typography'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SearchIcon from '@mui/icons-material/Search'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import EmptyState from 'components/EmptyState'
import TankThumbnail, { thumbnailFrame } from 'components/TankThumbnail'
import { radius, softShadow, typeScale } from 'theme/tokens'
import { formatNumber } from 'utils/formatNumber'
import { normalizeDecimal } from 'utils/parseDecimal'
import {
  filterOptions,
  filterTanks,
  groupByCapacity,
  hasFilters,
  NO_FILTERS,
  type CatalogFilters,
  type CatalogTank,
} from 'utils/tankCatalog'

interface TankCatalogProps {
  tanks: readonly CatalogTank[]
  /** The tank chosen now, marked with a ✓. */
  selectedKey?: string | null
  onChoose: (key: string) => void
  /** "modelo" with an account, "tanque" without. */
  noun: 'modelo' | 'tanque'
  /** Verb of each card's accessible name: "Seleccionar" or "Elegir". */
  actionLabel: string
}

const plural = (count: number, noun: string) =>
  `${String(count)} ${noun}${count === 1 ? '' : 's'}`

/** A row of chips, one chosen at most: "Todas" means no filter. */
function ChipRow<T extends string | number>({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string
  allLabel: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (value: T | null) => void
}) {
  const chip = (
    key: string,
    text: string,
    pressed: boolean,
    next: T | null
  ) => (
    <Chip
      key={key}
      label={text}
      clickable
      variant={pressed ? 'filled' : 'outlined'}
      color={pressed ? 'primary' : 'default'}
      aria-pressed={pressed}
      onClick={() => {
        onChange(next)
      }}
      sx={{ flexShrink: 0 }}
    />
  )
  return (
    <Box role="group" aria-label={label}>
      <Typography
        variant="overline"
        component="p"
        sx={{ color: 'text.secondary' }}
      >
        {label}
      </Typography>
      {/* One line that slides sideways on a phone (specs/0014 RF-3) */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 1,
          scrollbarWidth: 'none',
        }}
      >
        {chip('all', allLabel, value === null, null)}
        {options.map(option =>
          chip(
            String(option.value),
            option.label,
            value === option.value,
            value === option.value ? null : option.value
          )
        )}
      </Box>
    </Box>
  )
}

/**
 * Tanks to choose from, grouped by capacity, with filters and a 3D
 * thumbnail each (backend specs/0014). The same in the fleet's model dialog
 * and in the basic mode's "Elige tu tanque".
 */
export default function TankCatalog({
  tanks,
  selectedKey = null,
  onChoose,
  noun,
  actionLabel,
}: TankCatalogProps) {
  const [filters, setFilters] = useState<CatalogFilters>(NO_FILTERS)
  const [search, setSearch] = useState('')
  const query = useDeferredValue(normalizeDecimal(search) ?? search.trim())
  const options = useMemo(() => filterOptions(tanks), [tanks])
  const frame = useMemo(() => thumbnailFrame(tanks), [tanks])
  const groups = useMemo(
    () => groupByCapacity(filterTanks(tanks, { ...filters, query })),
    [tanks, filters, query]
  )
  const count = groups.reduce((sum, group) => sum + group.tanks.length, 0)
  const set = (change: Partial<CatalogFilters>) => {
    setFilters(current => ({ ...current, ...change }))
  }
  const clear = () => {
    setFilters(NO_FILTERS)
    setSearch('')
  }

  return (
    <Box>
      <OutlinedInput
        type="search"
        fullWidth
        placeholder="Ej. 100 o 24"
        value={search}
        onChange={event => {
          setSearch(event.target.value)
        }}
        startAdornment={
          <InputAdornment position="start">
            <SearchIcon />
          </InputAdornment>
        }
        slotProps={{
          input: {
            'aria-label': `Buscar ${noun}`,
            inputMode: 'decimal',
            autoComplete: 'off',
          },
        }}
      />

      <Box sx={{ display: 'grid', gap: 2, mt: 3 }}>
        <ChipRow
          label="Capacidad"
          allLabel="Todas"
          options={options.capacities.map(value => ({
            value,
            label: `${formatNumber(value)} gal`,
          }))}
          value={filters.capacity}
          onChange={capacity => {
            set({ capacity })
          }}
        />
        <ChipRow
          label="Diámetro"
          allLabel="Todos"
          options={options.diameters.map(value => ({
            value,
            label: `${formatNumber(value)} pulg.`,
          }))}
          value={filters.diameter}
          onChange={diameter => {
            set({ diameter })
          }}
        />
        <ChipRow
          label="Largo"
          allLabel="Todos"
          options={options.lengths.map(range => ({
            value: range.id,
            label: range.label,
          }))}
          value={filters.length}
          onChange={length => {
            set({ length })
          }}
        />
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mt: 2,
          mb: 3,
          minHeight: 36,
        }}
      >
        {/* Announces the count as the filters change (RF-6) */}
        <Typography
          role="status"
          variant="caption"
          sx={{ color: 'text.secondary' }}
        >
          {plural(count, noun)}
        </Typography>
        {hasFilters({ ...filters, query }) && (
          <Button size="small" onClick={clear}>
            Limpiar
          </Button>
        )}
      </Box>

      {count === 0 ? (
        <EmptyState
          headingLevel="h2"
          icon={<SearchOffIcon />}
          title={`Ningún ${noun} con esos filtros`}
          description="Quita algún filtro o prueba con otra medida."
          action={{ label: 'Limpiar', onClick: clear }}
        />
      ) : (
        groups.map(group => (
          <Box
            key={group.capacity}
            component="section"
            aria-label={`${formatNumber(group.capacity)} galones`}
            sx={{ mb: 4 }}
          >
            <Typography
              variant="overline"
              component="h3"
              sx={{ color: 'text.secondary', mb: 1 }}
            >
              {formatNumber(group.capacity)} gal ·{' '}
              {plural(group.tanks.length, noun)}
            </Typography>
            <Box
              component="ul"
              sx={{
                display: 'grid',
                // Two per row on a phone, more on wider screens
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 2,
                listStyle: 'none',
                m: 0,
                p: 0,
              }}
            >
              {group.tanks.map(tank => {
                const selected = tank.key === selectedKey
                const capacity = formatNumber(tank.capacity)
                const diameter = formatNumber(tank.diameter)
                const length = formatNumber(tank.length)
                return (
                  <li key={tank.key}>
                    <ButtonBase
                      onClick={() => {
                        onChoose(tank.key)
                      }}
                      aria-label={`${actionLabel}: tanque de ${capacity} galones, ${diameter} pulgadas de diámetro y ${length} de largo${tank.own ? ', tuyo' : ''}`}
                      aria-current={selected ? 'true' : undefined}
                      sx={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        gap: 1,
                        p: 3,
                        textAlign: 'left',
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: selected ? 'text.primary' : 'divider',
                        boxShadow: selected
                          ? theme =>
                              `inset 0 0 0 1px ${theme.palette.text.primary}`
                          : 'none',
                        borderRadius: `${String(radius.lg)}px`,
                        transition: 'box-shadow 0.15s',
                        '&:hover': {
                          boxShadow: selected ? undefined : softShadow,
                        },
                      }}
                    >
                      {selected && (
                        <CheckCircleIcon
                          aria-hidden="true"
                          sx={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            fontSize: 18,
                          }}
                        />
                      )}
                      <TankThumbnail
                        diameter={tank.diameter}
                        length={tank.length}
                        frame={frame}
                      />
                      <Box
                        sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}
                      >
                        <Typography
                          component="span"
                          sx={{ ...typeScale.figureSm, color: 'text.primary' }}
                        >
                          {capacity} gal
                        </Typography>
                        {tank.own && (
                          <Chip
                            label="Tuyo"
                            size="small"
                            variant="outlined"
                            component="span"
                          />
                        )}
                      </Box>
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{ color: 'text.secondary' }}
                      >
                        Ø {diameter} × {length} pulg.
                      </Typography>
                    </ButtonBase>
                  </li>
                )
              })}
            </Box>
          </Box>
        ))
      )}
    </Box>
  )
}
