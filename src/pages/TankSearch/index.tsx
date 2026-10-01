import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import InputAdornment from '@mui/material/InputAdornment'
import OutlinedInput from '@mui/material/OutlinedInput'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import SearchIcon from '@mui/icons-material/Search'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import EmptyState from 'components/EmptyState'
import TankCard from 'components/TankCard'
import { useSelectedTankStore } from 'store/selectedTank'
import { useTanksStore } from 'store/tanks'
import { radius } from 'theme/tokens'
import { normalizeDecimal } from 'utils/parseDecimal'
import type { Tank } from 'types'

// Roughly a TankCard, so the page does not jump when the list arrives
const CARD_HEIGHT = 72
const PLACEHOLDER_CARDS = 6

// Two tiles per row on a phone, more on wider screens
const tileGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
  gap: 2,
} as const

/** "24.5" and "24,5" find the same tank, and "1,500" finds 1500. */
const matches = (tank: Tank, query: string) =>
  [tank.capacity, tank.diameter, tank.length].some(value =>
    String(value).includes(query)
  )

export default function TankSearch() {
  const tanks = useTanksStore(state => state.tanks)
  const status = useTanksStore(state => state.status)
  const load = useTanksStore(state => state.load)
  const selectTank = useSelectedTankStore(state => state.selectTank)
  const selectedTankId = useSelectedTankStore(state => state.selectedTank?.id)
  const [, navigate] = useLocation()
  const [search, setSearch] = useState('')
  const query = useDeferredValue(normalizeDecimal(search) ?? search.trim())

  useEffect(() => {
    void load()
  }, [load])

  const visibleTanks = useMemo(
    () => (query ? tanks.filter(tank => matches(tank, query)) : tanks),
    [tanks, query]
  )

  const choose = (tank: Tank) => {
    selectTank(tank)
    navigate('/')
  }

  const addTank = () => {
    navigate('/tanques/crear')
  }

  const hasTanks = tanks.length > 0

  const renderList = () => {
    if (!hasTanks && status === 'error')
      return (
        <EmptyState
          headingLevel="h2"
          icon={<CloudOffIcon />}
          title="No pudimos cargar los tanques"
          description="Revisa que tu navegador permita guardar datos y vuelve a intentarlo."
          action={{ label: 'Reintentar', onClick: () => void load() }}
        />
      )

    if (!hasTanks && status === 'ready')
      return (
        <EmptyState
          headingLevel="h2"
          icon={<LocalGasStationIcon />}
          title="Aún no tienes tanques"
          description="Agrega las medidas de tu tanque para empezar a medir."
          action={{ label: 'Agregar tanque', onClick: addTank }}
        />
      )

    if (!hasTanks)
      return (
        <Box aria-busy="true" aria-label="Cargando tanques" sx={tileGrid}>
          {Array.from({ length: PLACEHOLDER_CARDS }, (_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              height={CARD_HEIGHT}
              sx={{ borderRadius: `${String(radius.lg)}px` }}
            />
          ))}
        </Box>
      )

    if (visibleTanks.length === 0)
      return (
        <EmptyState
          headingLevel="h2"
          icon={<SearchOffIcon />}
          title="No encontramos ese tanque"
          description={`Ningún tanque mide “${search.trim()}”. Prueba con otra medida o agrega el tuyo.`}
          action={{
            label: 'Limpiar búsqueda',
            onClick: () => {
              setSearch('')
            },
          }}
        />
      )

    return (
      <Box
        component="ul"
        aria-label="Tanques"
        sx={{ ...tileGrid, listStyle: 'none', m: 0, p: 0 }}
      >
        {visibleTanks.map(tank => (
          <li key={tank.id}>
            <TankCard
              tank={tank}
              actionLabel="Seleccionar"
              selected={tank.id === selectedTankId}
              onClick={() => {
                choose(tank)
              }}
            />
          </li>
        ))}
      </Box>
    )
  }

  return (
    <Box component="main" sx={{ p: 4 }}>
      <Typography variant="h3" component="h1">
        Elige tu tanque
      </Typography>
      <Typography variant="body2" sx={{ mt: 1, mb: 4 }}>
        Busca por capacidad, diámetro o longitud.
      </Typography>

      <OutlinedInput
        type="search"
        fullWidth
        placeholder="Ej. 100"
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
            'aria-label': 'Buscar tanque',
            inputMode: 'decimal',
            autoComplete: 'off',
          },
        }}
      />

      {/* Announces how many tanks match while the user types */}
      <Typography
        role="status"
        variant="caption"
        component="p"
        sx={{ color: 'text.secondary', mt: 2, mb: 3, minHeight: '1.5em' }}
      >
        {hasTanks &&
          (visibleTanks.length === 1
            ? '1 tanque'
            : `${String(visibleTanks.length)} tanques`)}
      </Typography>

      {renderList()}

      <Stack
        spacing={2}
        sx={{ alignItems: 'center', textAlign: 'center', mt: 8, mb: 4 }}
      >
        <Typography variant="subtitle1" component="h2">
          ¿Tu tanque no aparece?
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={addTank}>
          Agregar tanque
        </Button>
      </Stack>
    </Box>
  )
}
