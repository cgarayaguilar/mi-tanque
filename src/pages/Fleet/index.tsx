import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useParams } from 'wouter'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputAdornment from '@mui/material/InputAdornment'
import OutlinedInput from '@mui/material/OutlinedInput'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import SearchIcon from '@mui/icons-material/Search'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import ColorDot from 'components/ColorDot'
import EmptyState from 'components/EmptyState'
import NavBar from 'components/NavBar'
import SessionGate from 'components/SessionGate'
import TankShapeIcon from 'components/TankShapeIcon'
import type { FleetTank, LastMeasurement, Trailer, Truck } from 'schemas/fleet'
import { formatTimeAgo } from 'utils/formatDate'
import { useFleetStore } from 'store/fleet'
import { selectActiveRole, useSessionStore } from 'store/session'
import { layout, radius, softShadow } from 'theme/tokens'
import {
  tankMeasures,
  tankShapeLabel,
  trailerTypeLabel,
  truckFigures,
  vehicleSubtitle,
} from 'utils/fleetLabels'
import { FLEET_SECTIONS, sectionBySlug } from 'utils/fleetSections'
import { formatNumber } from 'utils/formatNumber'
import { canWriteFleet } from 'utils/roles'
import { useDistanceUnit } from 'hooks/useDistanceUnit'
import InsuranceChip from 'components/InsuranceChip'
import { insuranceNotice, type InsuranceNotice } from 'utils/insurance'

const CARD_HEIGHT = 88

interface CardProps {
  label: string
  leading: ReactNode
  title: string
  lines: (string | null)[]
  archived: boolean
  /** The insurance's notice, if it is due soon (backend specs/0011 RF-4). */
  notice?: InsuranceNotice | null
  onClick: () => void
}

function FleetCard({
  label,
  leading,
  title,
  lines,
  archived,
  notice = null,
  onClick,
}: CardProps) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={notice ? `${label}, ${notice.text}` : label}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 3,
        px: 4,
        py: 3,
        textAlign: 'left',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.lg)}px`,
        opacity: archived ? 0.7 : 1,
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: softShadow },
      }}
    >
      {leading}
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography
          component="span"
          variant="subtitle1"
          noWrap
          sx={{ display: 'block' }}
        >
          {title}
        </Typography>
        {lines.filter(Boolean).map(line => (
          <Typography
            key={line}
            component="span"
            variant="caption"
            noWrap
            sx={{ display: 'block', color: 'text.secondary' }}
          >
            {line}
          </Typography>
        ))}
        {notice && (
          <Box sx={{ mt: 1 }}>
            <InsuranceChip notice={notice} />
          </Box>
        )}
      </Box>
      {archived && <Chip label="Archivado" size="small" />}
    </ButtonBase>
  )
}

// "70 % · 84 gal · hace 2 h" (backend specs/0004 RF-18)
const lastMeasurementLine = (last: LastMeasurement) =>
  `${formatNumber(Math.round(last.fillPercent))} % · ${formatNumber(Math.round(last.gallons))} gal · ${formatTimeAgo(last.takenAt)}`

const matches = (
  query: string,
  ...fields: (string | number | null | undefined)[]
) =>
  fields.some(field =>
    String(field ?? '')
      .toLowerCase()
      .includes(query)
  )

function FleetScreen() {
  const params = useParams<{ section?: string }>()
  const section = sectionBySlug(params.section)
  const [, navigate] = useLocation()
  const orgId = useSessionStore(state => state.organization?.id ?? null)
  const role = useSessionStore(selectActiveRole)
  const { status, trucks, trailers, tanks, load } = useFleetStore()
  const distanceUnit = useDistanceUnit()
  const today = new Date()
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const query = useDeferredValue(search.trim().toLowerCase())
  const canWrite = canWriteFleet(role)

  useEffect(() => {
    if (orgId) void load(orgId)
  }, [orgId, load])

  const truckName = useMemo(
    () => new Map(trucks.map(truck => [truck.id, truck.name])),
    [trucks]
  )
  const trailerName = useMemo(
    () => new Map(trailers.map(trailer => [trailer.id, trailer.name])),
    [trailers]
  )
  const tanksPerTruck = useMemo(() => {
    const counts = new Map<string, number>()
    for (const tank of tanks) {
      if (tank.equipment.kind === 'truck' && !tank.archived) {
        counts.set(tank.equipment.id, (counts.get(tank.equipment.id) ?? 0) + 1)
      }
    }
    return counts
  }, [tanks])

  const open = (id: string) => {
    navigate(`/flota/${section.slug}/${id}`)
  }

  const equipmentName = (tank: FleetTank) =>
    tank.equipment.kind === 'truck'
      ? (truckName.get(tank.equipment.id) ?? 'Camión')
      : tank.equipment.kind === 'trailer'
        ? (trailerName.get(tank.equipment.id) ?? 'Remolque')
        : 'Individual'

  const visible = <T extends { archived: boolean }>(
    items: T[],
    match: (item: T) => boolean
  ) =>
    items.filter(
      item => item.archived === showArchived && (!query || match(item))
    )

  const cards: { id: string; card: ReactNode }[] =
    section.collection === 'trucks'
      ? visible(trucks, (t: Truck) =>
          matches(query, t.name, t.plate, t.brand, t.model, t.color?.label)
        ).map(truck => {
          const { efficiency, odometer } = truckFigures(truck, distanceUnit)
          const tankCount = tanksPerTruck.get(truck.id) ?? 0
          return {
            id: truck.id,
            card: (
              <FleetCard
                label={`Camión ${truck.name}`}
                leading={<ColorDot swatch={truck.color?.swatch} size={20} />}
                title={truck.name}
                lines={[
                  vehicleSubtitle(truck) || null,
                  [
                    tankCount === 1
                      ? '1 tanque'
                      : `${String(tankCount)} tanques`,
                    efficiency,
                    odometer,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                ]}
                archived={truck.archived}
                notice={insuranceNotice(
                  truck.insuranceExpiresOn,
                  today,
                  truck.archived
                )}
                onClick={() => {
                  open(truck.id)
                }}
              />
            ),
          }
        })
      : section.collection === 'trailers'
        ? visible(trailers, (t: Trailer) =>
            matches(query, t.name, t.plate, trailerTypeLabel(t), t.color?.label)
          ).map(trailer => ({
            id: trailer.id,
            card: (
              <FleetCard
                label={`Remolque ${trailer.name}`}
                leading={<ColorDot swatch={trailer.color?.swatch} size={20} />}
                title={trailer.name}
                lines={[
                  [trailerTypeLabel(trailer), trailer.plate]
                    .filter(Boolean)
                    .join(' · '),
                  trailer.hitchedTruckId
                    ? `Enganchado a ${truckName.get(trailer.hitchedTruckId) ?? 'un camión'}`
                    : 'Sin enganchar',
                ]}
                archived={trailer.archived}
                notice={insuranceNotice(
                  trailer.insuranceExpiresOn,
                  today,
                  trailer.archived
                )}
                onClick={() => {
                  open(trailer.id)
                }}
              />
            ),
          }))
        : visible(tanks, (t: FleetTank) =>
            matches(query, t.name, equipmentName(t), t.capacityGal)
          ).map(tank => ({
            id: tank.id,
            card: (
              <FleetCard
                label={`Tanque ${tank.name}`}
                leading={<TankShapeIcon shape={tank.shape} size={36} />}
                title={tank.name}
                lines={[
                  `${tankShapeLabel(tank)} · ${tankMeasures(tank)}`,
                  `${formatNumber(tank.capacityGal)} gal · ${equipmentName(tank)}`,
                  tank.lastMeasurement &&
                    lastMeasurementLine(tank.lastMeasurement),
                ]}
                archived={tank.archived}
                onClick={() => {
                  open(tank.id)
                }}
              />
            ),
          }))

  const total =
    section.collection === 'trucks'
      ? trucks.length
      : section.collection === 'trailers'
        ? trailers.length
        : tanks.length

  const renderList = () => {
    if (status === 'error' && total === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<CloudOffIcon />}
          title="No pudimos cargar tu flota"
          description="Revisa tu conexión y vuelve a intentarlo."
          action={{
            label: 'Reintentar',
            onClick: () => orgId && void load(orgId),
          }}
        />
      )
    }
    if (status !== 'ready' && total === 0) {
      return (
        <Stack
          spacing={2}
          aria-busy="true"
          aria-label={`Cargando ${section.label.toLowerCase()}`}
        >
          {[0, 1, 2].map(index => (
            <Skeleton
              key={index}
              variant="rounded"
              height={CARD_HEIGHT}
              sx={{ borderRadius: `${String(radius.lg)}px` }}
            />
          ))}
        </Stack>
      )
    }
    if (cards.length === 0 && !query && !showArchived && total > 0) {
      // Everything is archived: say so instead of "you have none"
      return (
        <EmptyState
          headingLevel="h2"
          icon={<LocalShippingIcon />}
          title={`Todos tus ${section.label.toLowerCase()} están archivados`}
          description="Puedes verlos y restaurarlos cuando los necesites."
          action={{
            label: 'Ver archivados',
            onClick: () => {
              setShowArchived(true)
            },
          }}
        />
      )
    }
    if (cards.length === 0 && !query && !showArchived) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<LocalShippingIcon />}
          title={`Aún no tienes ${section.label.toLowerCase()}`}
          description={
            canWrite
              ? `Agrega tu primer ${section.one} para tener su información a mano.`
              : 'Cuando tu equipo los agregue, aparecerán aquí.'
          }
          {...(canWrite && {
            action: {
              label: section.add,
              onClick: () => {
                navigate(`/flota/${section.slug}/nuevo`)
              },
            },
          })}
        />
      )
    }
    if (cards.length === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<SearchOffIcon />}
          title={showArchived ? 'No hay archivados' : 'Sin resultados'}
          description={
            showArchived
              ? `Aquí aparecen los ${section.label.toLowerCase()} que archives.`
              : 'Prueba con otro nombre, placa o medida.'
          }
          action={
            showArchived
              ? {
                  label: 'Ver activos',
                  onClick: () => {
                    setShowArchived(false)
                  },
                }
              : {
                  label: 'Limpiar búsqueda',
                  onClick: () => {
                    setSearch('')
                  },
                }
          }
        />
      )
    }
    return (
      <Stack
        component="ul"
        spacing={2}
        aria-label={section.label}
        sx={{ listStyle: 'none', m: 0, p: 0 }}
      >
        {cards.map(({ id, card }) => (
          <li key={id}>{card}</li>
        ))}
      </Stack>
    )
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: `calc(100dvh - ${String(layout.appBarHeight)}px)`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ px: 4, pt: 2, pb: 4, flexGrow: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography variant="h3" component="h1">
            Flota
          </Typography>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                navigate(`/flota/${section.slug}/nuevo`)
              }}
            >
              Agregar
            </Button>
          )}
        </Box>

        <Tabs
          value={section.slug}
          onChange={(_, slug: string) => {
            setSearch('')
            navigate(`/flota/${slug}`)
          }}
          variant="fullWidth"
          aria-label="Secciones de la flota"
          sx={{ mt: 3, mb: 4, borderBottom: 1, borderColor: 'divider' }}
        >
          {FLEET_SECTIONS.map(item => (
            <Tab key={item.slug} value={item.slug} label={item.label} />
          ))}
        </Tabs>

        <OutlinedInput
          type="search"
          fullWidth
          placeholder="Buscar"
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
            input: { 'aria-label': `Buscar ${section.label.toLowerCase()}` },
          }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={showArchived}
              onChange={event => {
                setShowArchived(event.target.checked)
              }}
            />
          }
          label="Ver archivados"
          sx={{ my: 2 }}
        />

        {renderList()}
      </Box>
      <NavBar />
    </Box>
  )
}

export default function Fleet() {
  return (
    <SessionGate needs="ready">
      <FleetScreen />
    </SessionGate>
  )
}
