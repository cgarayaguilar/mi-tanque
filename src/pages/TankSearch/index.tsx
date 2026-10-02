import { useEffect, useMemo } from 'react'
import { useLocation } from 'wouter'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import EmptyState from 'components/EmptyState'
import TankCatalog from 'components/TankCatalog'
import { PREDEFINED_TANKS } from 'services/tanks'
import { useSelectedTankStore } from 'store/selectedTank'
import { useTanksStore } from 'store/tanks'
import { radius } from 'theme/tokens'
import type { Tank } from 'types'
import type { CatalogTank } from 'utils/tankCatalog'

// Roughly a TankCard, so the page does not jump when the list arrives
const CARD_HEIGHT = 72
const PLACEHOLDER_CARDS = 6

// Two tiles per row on a phone, more on wider screens
const tileGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
  gap: 2,
} as const

/** One of the 15 predefined tanks, or one the user added ("Tuyo"). */
const isPredefined = (tank: Tank) =>
  PREDEFINED_TANKS.some(
    predefined =>
      predefined.capacity === tank.capacity &&
      predefined.diameter === tank.diameter &&
      predefined.length === tank.length
  )

export default function TankSearch() {
  const tanks = useTanksStore(state => state.tanks)
  const status = useTanksStore(state => state.status)
  const load = useTanksStore(state => state.load)
  const selectTank = useSelectedTankStore(state => state.selectTank)
  const selectedTankId = useSelectedTankStore(state => state.selectedTank?.id)
  const [, navigate] = useLocation()

  useEffect(() => {
    void load()
  }, [load])

  const catalog = useMemo<CatalogTank[]>(
    () =>
      tanks.map(tank => ({
        key: String(tank.id),
        capacity: tank.capacity,
        diameter: tank.diameter,
        length: tank.length,
        own: !isPredefined(tank),
      })),
    [tanks]
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

    return (
      <TankCatalog
        tanks={catalog}
        selectedKey={
          selectedTankId === undefined ? null : String(selectedTankId)
        }
        noun="tanque"
        actionLabel="Seleccionar"
        onChoose={key => {
          const tank = tanks.find(item => String(item.id) === key)
          if (tank) choose(tank)
        }}
      />
    )
  }

  return (
    <Box component="main" sx={{ p: 4 }}>
      <Typography variant="h3" component="h1">
        Elige tu tanque
      </Typography>
      <Typography variant="body2" sx={{ mt: 1, mb: 4 }}>
        Agrupados por capacidad. Filtra por galones, diámetro o largo.
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
