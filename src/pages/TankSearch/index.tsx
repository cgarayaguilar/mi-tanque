import { useEffect, useMemo } from 'react'
import { useLocation } from 'wouter'
import { sileo } from 'sileo'
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
import { PREDEFINED_TANKS, sameDimensions } from 'services/tanks'
import { useSelectedTankStore } from 'store/selectedTank'
import { useTanksStore } from 'store/tanks'
import { radius } from 'theme/tokens'
import type { Tank, TankDimensions } from 'types'
import { reportError } from 'utils/reportError'
import type { CatalogTank } from 'utils/tankCatalog'
import {
  GENERIC_BRAND,
  TANK_TEMPLATES,
  templateById,
  toCatalogTank,
  type TankTemplate,
} from 'utils/tankTemplates'
import { thumbnailOf } from 'utils/tankText'

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
  PREDEFINED_TANKS.some(predefined => sameDimensions(predefined, tank))

/** A template of the catalog as this phone's tank, of its shape. */
const dimensionsOf = (template: TankTemplate): TankDimensions => {
  const common = {
    capacity: template.capacityGal,
    orientation: 'horizontal' as const,
    length: template.dimensions.lengthIn,
  }
  const { dimensions } = template
  if (template.shape === 'cylinder' && 'diameterIn' in dimensions)
    return { ...common, shape: 'cylinder', diameter: dimensions.diameterIn }
  if (template.shape !== 'cylinder' && 'heightIn' in dimensions)
    return {
      ...common,
      shape: template.shape,
      height: dimensions.heightIn,
      width: dimensions.widthIn,
    }
  throw new Error(`Template ${template.id} without the measures of its shape`)
}

export default function TankSearch() {
  const tanks = useTanksStore(state => state.tanks)
  const status = useTanksStore(state => state.status)
  const load = useTanksStore(state => state.load)
  const addCatalogTank = useTanksStore(state => state.addCatalogTank)
  const selectTank = useSelectedTankStore(state => state.selectTank)
  const selectedTankId = useSelectedTankStore(state => state.selectedTank?.id)
  const [, navigate] = useLocation()

  useEffect(() => {
    void load()
  }, [load])

  // This phone's tanks, then the catalog's not saved yet, of every shape
  // (specs/0015 RF-11, specs/0019 RF-4)
  const catalog = useMemo<CatalogTank[]>(() => {
    const saved = new Set(tanks.flatMap(tank => tank.catalogId ?? []))
    const local = tanks.map((tank): CatalogTank => {
      const template = templateById(tank.catalogId)
      if (template)
        return { ...toCatalogTank(template), key: `t:${String(tank.id)}` }
      return {
        key: `t:${String(tank.id)}`,
        ...thumbnailOf(tank),
        capacity: tank.capacity,
        ...(isPredefined(tank)
          ? { brand: GENERIC_BRAND, models: [] }
          : { own: true }),
      }
    })
    const fromCatalog = TANK_TEMPLATES.filter(
      template => template.sourced && !saved.has(template.id)
    ).map(template => ({ ...toCatalogTank(template), key: `c:${template.id}` }))
    return [...local, ...fromCatalog]
  }, [tanks])

  const choose = (tank: Tank) => {
    selectTank(tank)
    navigate('/')
  }

  const chooseKey = async (key: string) => {
    const tank = tanks.find(item => `t:${String(item.id)}` === key)
    if (tank) {
      choose(tank)
      return
    }
    const template = templateById(key.replace(/^c:/, ''))
    if (!template) return
    try {
      choose(await addCatalogTank(template.id, dimensionsOf(template)))
    } catch (error) {
      reportError(error, {
        operation: 'saveCatalogTank',
        catalogId: template.id,
      })
      sileo.error({
        title: 'No pudimos guardar el tanque',
        description: 'Reintenta en un momento.',
      })
    }
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
          selectedTankId === undefined ? null : `t:${String(selectedTankId)}`
        }
        noun="tanque"
        actionLabel="Seleccionar"
        onChoose={key => {
          void chooseKey(key)
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
