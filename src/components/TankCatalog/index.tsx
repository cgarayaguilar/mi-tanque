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
import FilterChip, { FilterBar } from 'components/FilterChip'
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
  LENGTH_RANGES,
  measuresText,
  spokenKind,
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
  /** Where it opens, e.g. on the tank's truck (specs/0016 RF-6). */
  initialFilters?: Partial<CatalogFilters>
}

// Cards drawn at a time; "Ver más" adds as many again
const PAGE = 24

const plural = (count: number, noun: string) =>
  `${String(count)} ${noun}${count === 1 ? '' : 's'}`

/** The card's accessible name: what the tank is, in words. */
const spokenTank = (tank: CatalogTank, actionLabel: string) => {
  const gallons = `tanque de ${formatNumber(tank.capacity)} galones`
  const length = `${formatNumber(tank.length)} de ${tank.orientation === 'vertical' ? 'altura' : 'largo'}`
  const measures =
    tank.width === null
      ? `${tank.orientation === 'vertical' ? 'de pie, ' : ''}${formatNumber(tank.size)} pulgadas de diámetro y ${length}`
      : `${spokenKind(tank).replace(/^en d/, 'en D')}, ${formatNumber(tank.size)} de alto, ${formatNumber(tank.width)} de ancho y ${length}`
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
  initialFilters,
}: TankCatalogProps) {
  const [filters, setFilters] = useState<CatalogFilters>(() => ({
    ...NO_FILTERS,
    ...initialFilters,
  }))
  const [search, setSearch] = useState('')
  const query = useDeferredValue(normalizeDecimal(search) ?? search.trim())
  const options = useMemo(() => filterOptions(tanks), [tanks])
  // The other rows offer what the chosen brand and model have (RF-7)
  const scoped = useMemo(
    () =>
      filterOptions(
        filterTanks(tanks, {
          ...NO_FILTERS,
          brand: filters.brand,
          model: filters.model,
        })
      ),
    [tanks, filters.brand, filters.model]
  )
  /** A chosen value stays offered, even if the brand does not have it. */
  const keep = <T,>(values: readonly T[], chosen: T | null) =>
    chosen === null || values.includes(chosen) ? values : [chosen, ...values]
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

      {/* One chip per filter, each with its menu (specs/0017 RF-6) */}
      <Box sx={{ mt: 3 }}>
        <FilterBar>
          {options.brands.length > 0 && (
            <FilterChip
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
            <FilterChip
              label="Modelo"
              allLabel="Todos"
              options={models.map(value => ({ value, label: value }))}
              value={filters.model}
              onChange={model => {
                set({ model })
              }}
            />
          )}
          <FilterChip
            label="Capacidad"
            allLabel="Todas"
            options={keep(scoped.capacities, filters.capacity).map(value => ({
              value,
              label: `${formatNumber(value)} gal`,
            }))}
            value={filters.capacity}
            onChange={capacity => {
              set({ capacity })
            }}
          />
          <FilterChip
            label="Diámetro"
            allLabel="Todos"
            options={keep(scoped.diameters, filters.diameter).map(value => ({
              value,
              label: `${formatNumber(value)} pulg.`,
            }))}
            value={filters.diameter}
            onChange={diameter => {
              set({ diameter })
            }}
          />
          <FilterChip
            label="Largo"
            allLabel="Todos"
            options={LENGTH_RANGES.filter(
              range =>
                scoped.lengths.includes(range) || range.id === filters.length
            ).map(range => ({
              value: range.id,
              label: range.label,
            }))}
            value={filters.length}
            onChange={length => {
              set({ length })
            }}
          />
        </FilterBar>
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
