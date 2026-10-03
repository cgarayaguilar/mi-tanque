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
  fitsText,
  groupByCapacity,
  hasFilters,
  measuresText,
  modelsOf,
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

// Cards drawn at a time; "Ver más" adds as many again
const PAGE = 24

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

/** The card's accessible name: what the tank is, in words. */
const spokenTank = (tank: CatalogTank, actionLabel: string) => {
  const gallons = `tanque de ${formatNumber(tank.capacity)} galones`
  const measures =
    tank.width === null
      ? `${formatNumber(tank.size)} pulgadas de diámetro y ${formatNumber(tank.length)} de largo`
      : `${tank.shape === 'd_flat_side' ? 'en D' : 'rectangular'}, ${formatNumber(tank.size)} de alto, ${formatNumber(tank.width)} de ancho y ${formatNumber(tank.length)} de largo`
  return `${actionLabel}: ${gallons}, ${measures}${tank.own ? ', tuyo' : ''}`
}

/**
 * Tanks to choose from, by brand and model, grouped by capacity, with
 * filters and a 3D thumbnail each (backend specs/0014, specs/0015). The same
 * in the fleet's model dialog and in the basic mode's "Elige tu tanque".
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
  const models = useMemo(
    () => (filters.brand === null ? [] : modelsOf(tanks, filters.brand)),
    [tanks, filters.brand]
  )
  const frame = useMemo(() => thumbnailFrame(tanks), [tanks])
  const groups = useMemo(
    () => groupByCapacity(filterTanks(tanks, { ...filters, query })),
    [tanks, filters, query]
  )
  const count = groups.reduce((sum, group) => sum + group.tanks.length, 0)
  // A few cards at a time: hundreds at once were slow to build on a phone
  // (specs/0015 RNF-2). Any filter starts the list over.
  const [shown, setShown] = useState(PAGE)
  const [shownFor, setShownFor] = useState(groups)
  if (shownFor !== groups) {
    setShownFor(groups)
    setShown(PAGE)
  }
  let budget = shown
  const visibleGroups = groups.flatMap(group => {
    if (budget <= 0) return []
    const tanksShown = group.tanks.slice(0, budget)
    budget -= tanksShown.length
    return [{ ...group, shownTanks: tanksShown }]
  })
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
        placeholder="Ej. Volvo, T680 o 120"
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
          input: { 'aria-label': `Buscar ${noun}`, autoComplete: 'off' },
        }}
      />

      <Box sx={{ display: 'grid', gap: 2, mt: 3 }}>
        {options.brands.length > 0 && (
          <ChipRow
            label="Marca"
            allLabel="Todas"
            options={options.brands.map(value => ({ value, label: value }))}
            value={filters.brand}
            onChange={brand => {
              // A model belongs to one brand
              set({ brand, model: null })
            }}
          />
        )}
        {filters.brand !== null && models.length > 0 && (
          <ChipRow
            label="Modelo"
            allLabel="Todos"
            options={models.map(value => ({ value, label: value }))}
            value={filters.model}
            onChange={model => {
              set({ model })
            }}
          />
        )}
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

      {filters.brand !== null && filters.model !== null && (
        // One truck may have shipped with several tanks: the tape decides
        <Box
          role="note"
          sx={{
            mt: 3,
            px: 3,
            py: 2,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: `${String(radius.lg)}px`,
          }}
        >
          <Typography variant="subtitle2" component="p">
            {filters.brand} {filters.model} · {plural(count, 'tanque')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            De fábrica traía alguno de estos. Mide el diámetro (o el alto) de tu
            tanque con una cinta y elige el que coincide.
          </Typography>
        </Box>
      )}

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
        visibleGroups.map(group => (
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
              {group.shownTanks.map(tank => {
                const selected = tank.key === selectedKey
                const fits =
                  filters.model === null
                    ? fitsText(tank, filters.brand === null)
                    : null
                return (
                  <Box
                    component="li"
                    key={tank.key}
                    // Off-screen cards are not drawn: hundreds stay fast
                    // (specs/0015 RNF-2)
                    sx={{
                      contentVisibility: 'auto',
                      containIntrinsicSize: 'auto 200px',
                    }}
                  >
                    <ButtonBase
                      onClick={() => {
                        onChoose(tank.key)
                      }}
                      aria-label={spokenTank(tank, actionLabel)}
                      aria-current={selected ? 'true' : undefined}
                      sx={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        justifyContent: 'flex-start',
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
                      <TankThumbnail tank={tank} frame={frame} />
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'baseline',
                          flexWrap: 'wrap',
                          columnGap: 1,
                        }}
                      >
                        <Typography
                          component="span"
                          sx={{ ...typeScale.figureSm, color: 'text.primary' }}
                        >
                          {formatNumber(tank.capacity)} gal
                        </Typography>
                        {tank.usable !== undefined && (
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ color: 'text.secondary' }}
                          >
                            ({formatNumber(tank.usable)} útiles)
                          </Typography>
                        )}
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
                        {measuresText(tank)}
                      </Typography>
                      {fits && (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ color: 'text.primary' }}
                        >
                          {fits}
                        </Typography>
                      )}
                      {tank.calculated && (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ color: 'text.secondary', fontStyle: 'italic' }}
                        >
                          Medidas calculadas: confírmalas con una cinta
                        </Typography>
                      )}
                    </ButtonBase>
                  </Box>
                )
              })}
            </Box>
          </Box>
        ))
      )}
      {count > shown && (
        <Button
          variant="outlined"
          fullWidth
          onClick={() => {
            setShown(value => value + PAGE)
          }}
        >
          Ver más ({String(count - shown)})
        </Button>
      )}
    </Box>
  )
}
