import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation } from 'wouter'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import EmptyState from 'components/EmptyState'
import ModeToggle, { type MeasureMode } from 'components/ModeToggle'
import CloudRefuel from 'pages/Home/CloudRefuel'
import CapacityMismatchNote from 'components/CapacityMismatchNote'
import FuelGauge from 'components/FuelGauge'
import NumberField from 'components/NumberField'
import Stat from 'components/Stat'
import TankShapeIcon from 'components/TankShapeIcon'
import { AutocompleteBase } from 'components/AutocompleteField'
import { useSaveCloudMeasurement } from 'hooks/useSaveCloudMeasurement'
import type { FleetTank, Truck } from 'schemas/fleet'
import {
  fleetMeasureFormSchema,
  type FleetMeasureFormValues,
} from 'schemas/measurementForm'
import { useFleetStore } from 'store/fleet'
import { selectActiveRole, useSessionStore } from 'store/session'
import { radius } from 'theme/tokens'
import { tankMeasures } from 'utils/fleetLabels'
import { formatNumber } from 'utils/formatNumber'
import { LEVEL_GROUND } from 'utils/measureHelp'
import {
  efficienciesOf,
  maxInchesFor,
  rangeTruckFor,
  readingFor,
  capacityMismatchOf,
  type CloudReading,
  type RangeEstimate,
} from 'utils/measurementMath'
import { parseDecimal } from 'utils/parseDecimal'
import { reportError } from 'utils/reportError'
import { canWriteFleet } from 'utils/roles'
import { useDistanceUnit } from 'hooks/useDistanceUnit'
import { RETRY_HINT } from 'utils/withTimeout'

const NOT_MEASURED = '—'
const INDIVIDUAL = 'none'

const lastTankKey = (orgId: string) => `lastTank:${orgId}`

const readLastTank = (orgId: string) => {
  try {
    return window.localStorage.getItem(lastTankKey(orgId))
  } catch {
    return null
  }
}

const rememberTank = (orgId: string, tankId: string) => {
  try {
    window.localStorage.setItem(lastTankKey(orgId), tankId)
  } catch (error) {
    // Only a convenience for next time
    reportError(error, { operation: 'rememberTank' })
  }
}

/** "truck:ID", "trailer:ID" or "none" (individual tanks). */
const equipmentKey = (tank: FleetTank) =>
  tank.equipment.kind === 'none'
    ? INDIVIDUAL
    : `${tank.equipment.kind}:${tank.equipment.id}`

function CloudResults({
  reading,
  truck,
  mismatch,
}: {
  reading: CloudReading | null
  truck: Truck | null
  mismatch?: ReactNode
}) {
  const unit = useDistanceUnit()
  // In the organization's unit, the other in parentheses
  const distance = (estimate: RangeEstimate) =>
    unit === 'mi'
      ? `unos ${formatNumber(Math.round(estimate.miles))} mi (${formatNumber(Math.round(estimate.km))} km)`
      : `unos ${formatNumber(Math.round(estimate.km))} km (${formatNumber(Math.round(estimate.miles))} mi)`
  const loaded = reading?.estimate ?? null
  const empty = reading?.estimateEmpty ?? null
  // Loaded and empty, each when the truck has it (backend specs/0021 RF-6)
  const missing =
    truck && (loaded === null) !== (empty === null)
      ? `Agrega el rendimiento ${loaded ? 'vacío' : 'cargado'} de ${truck.name} para ver las dos.`
      : null

  return (
    <Box component="section" aria-label="Resultados">
      <FuelGauge
        reading={
          reading && {
            inches: reading.inches,
            gallons: reading.gallons.toFixed(2),
            liters: reading.liters.toFixed(2),
            fuelHeight: reading.fillPercent.toFixed(2),
          }
        }
      />
      <Box
        aria-live="polite"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          textAlign: 'center',
        }}
      >
        <Stat
          label="Pulgadas"
          value={reading ? formatNumber(reading.inches) : NOT_MEASURED}
        />
        <Stat
          label="Galones"
          value={reading ? formatNumber(reading.gallons, 2) : NOT_MEASURED}
        />
        <Stat
          label="Litros"
          value={reading ? formatNumber(reading.liters, 2) : NOT_MEASURED}
        />
      </Box>
      {reading && (
        <Typography
          variant="body2"
          role="status"
          sx={{ mt: 3, textAlign: 'center' }}
        >
          {loaded || empty ? (
            <>
              {loaded && <span>Cargado: {distance(loaded)}</span>}
              {loaded && empty && <br />}
              {empty && <span>Vacío: {distance(empty)}</span>}
              {missing && (
                <Box
                  component="span"
                  sx={{ display: 'block', mt: 1, color: 'text.secondary' }}
                >
                  {missing}
                </Box>
              )}
            </>
          ) : truck ? (
            `Agrega el rendimiento de ${truck.name} para estimar la distancia.`
          ) : (
            'Este tanque no es de un camión: no hay estimación de distancia.'
          )}
        </Typography>
      )}
      {reading && mismatch}
    </Box>
  )
}

/**
 * The tank to measure, with its shape and measures, and "Cambiar" to pick
 * another of the same equipment: one control instead of a select plus a
 * summary (owner, 2026-10-02). Without a choice yet, it asks for one.
 */
function TankCard({
  tank,
  tanks,
  onChoose,
}: {
  tank: FleetTank | null
  tanks: readonly FleetTank[]
  onChoose: (id: string) => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const canChange = tanks.length > 1

  return (
    <Box
      ref={cardRef}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        mt: 4,
        px: 3,
        py: 3,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.lg)}px`,
      }}
    >
      {tank && <TankShapeIcon shape={tank.shape} size={28} />}
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="subtitle1" component="p" noWrap>
          {tank ? tank.name : 'Elige el tanque'}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {tank
            ? `${tankMeasures(tank)} · ${formatNumber(tank.capacityGal)} gal`
            : `${String(tanks.length)} tanques en este equipo`}
        </Typography>
      </Box>
      {canChange && (
        <>
          <Button
            variant="outlined"
            size="small"
            aria-haspopup="menu"
            aria-expanded={anchor !== null}
            aria-controls={anchor ? menuId : undefined}
            aria-label={tank ? `Cambiar tanque: ${tank.name}` : 'Elegir tanque'}
            onClick={() => {
              setAnchor(cardRef.current)
            }}
            sx={{ flexShrink: 0 }}
          >
            {tank ? 'Cambiar' : 'Elegir'}
          </Button>
          <Menu
            id={menuId}
            anchorEl={anchor}
            open={anchor !== null}
            onClose={() => {
              setAnchor(null)
            }}
            // As wide as the card, under it; long names end in "…"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            slotProps={{ paper: { sx: { width: anchor?.clientWidth } } }}
          >
            {tanks.map(item => (
              <MenuItem
                key={item.id}
                selected={item.id === tank?.id}
                onClick={() => {
                  setAnchor(null)
                  onChoose(item.id)
                }}
              >
                <ListItemIcon>
                  <TankShapeIcon shape={item.shape} size={28} />
                </ListItemIcon>
                <ListItemText
                  slotProps={{
                    primary: { noWrap: true },
                    secondary: { noWrap: true },
                  }}
                  primary={item.name}
                  secondary={`${tankMeasures(item)} · ${formatNumber(item.capacityGal)} gal`}
                />
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  )
}

function MeasureForm({
  tank,
  truck,
  canSave,
  onSaved,
  save,
}: {
  tank: FleetTank
  truck: Truck | null
  canSave: boolean
  onSaved: () => void
  save: (tank: FleetTank, reading: CloudReading) => void
}) {
  const [reading, setReading] = useState<CloudReading | null>(null)
  const [, navigate] = useLocation()
  const maxInches = maxInchesFor(tank)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FleetMeasureFormValues>({
    resolver: zodResolver(fleetMeasureFormSchema(maxInches)),
    defaultValues: { inches: '' },
  })

  const onSubmit = ({ inches }: FleetMeasureFormValues) => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
    const next = readingFor(tank, parseDecimal(inches), efficienciesOf(truck))
    setReading(next)
    if (!canSave) return
    save(tank, next)
    onSaved()
  }

  return (
    <>
      <Box
        component="form"
        noValidate
        aria-label="Nueva medición"
        onSubmit={event => {
          void handleSubmit(onSubmit)(event)
        }}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 4 }}
      >
        <NumberField
          id="inches"
          label="Pulgadas de combustible"
          unit="pulg."
          placeholder="Ej. 12.5"
          hint={`Entre 0 y ${formatNumber(maxInches)}. ${LEVEL_GROUND}`}
          error={errors.inches?.message}
          registration={register('inches')}
        />
        <Button type="submit" variant="contained" size="large" fullWidth>
          Calcular
        </Button>
        {!canSave && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', textAlign: 'center' }}
          >
            Con tu rol de Lectura puedes calcular, pero no se guarda la
            medición.
          </Typography>
        )}
      </Box>
      <CloudResults
        reading={reading}
        truck={truck}
        mismatch={
          capacityMismatchOf(tank) && (
            <CapacityMismatchNote
              actionLabel="Revisar el tanque"
              onAction={() => {
                navigate(`/flota/tanques/${tank.id}`)
              }}
            />
          )
        }
      />
    </>
  )
}

/** Measurement with a session: the organization's tanks (backend specs/0004). */
export default function CloudMeasurement() {
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const role = useSessionStore(selectActiveRole)
  const { status, trucks, trailers, tanks, load } = useFleetStore()
  const [, navigate] = useLocation()
  const [chosenEquipment, setChosenEquipment] = useState<string | null>(null)
  const [chosenTank, setChosenTank] = useState<string | null>(null)
  const [mode, setMode] = useState<MeasureMode>('measure')

  useEffect(() => {
    if (orgId) void load(orgId)
  }, [orgId, load])

  const activeTanks = useMemo(
    () => tanks.filter(tank => !tank.archived),
    [tanks]
  )
  const nameOf = useMemo(() => {
    const names = new Map<string, string>()
    for (const truck of trucks) names.set(`truck:${truck.id}`, truck.name)
    for (const trailer of trailers)
      names.set(`trailer:${trailer.id}`, trailer.name)
    return names
  }, [trucks, trailers])

  // Equipment with active tanks, trucks first (RF-1)
  const equipmentOptions = useMemo(() => {
    const keys = new Set(activeTanks.map(equipmentKey))
    const options: { value: string; label: string }[] = []
    for (const truck of trucks) {
      const key = `truck:${truck.id}`
      if (keys.has(key))
        options.push({ value: key, label: `Camión · ${truck.name}` })
    }
    for (const trailer of trailers) {
      const key = `trailer:${trailer.id}`
      if (keys.has(key))
        options.push({ value: key, label: `Remolque · ${trailer.name}` })
    }
    if (keys.has(INDIVIDUAL))
      options.push({ value: INDIVIDUAL, label: 'Tanques individuales' })
    return options
  }, [activeTanks, trucks, trailers])

  const remembered = activeTanks.find(tank => tank.id === readLastTank(orgId))
  const equipment =
    (chosenEquipment !== null &&
    equipmentOptions.some(o => o.value === chosenEquipment)
      ? chosenEquipment
      : null) ??
    (remembered ? equipmentKey(remembered) : null) ??
    equipmentOptions[0]?.value ??
    null
  const tanksOfEquipment = activeTanks.filter(
    tank => equipmentKey(tank) === equipment
  )
  const tank =
    tanksOfEquipment.find(item => item.id === chosenTank) ??
    (remembered && equipmentKey(remembered) === equipment
      ? remembered
      : undefined) ??
    (tanksOfEquipment.length === 1 ? tanksOfEquipment[0] : undefined) ??
    null

  const equipmentNameOf = (item: FleetTank) =>
    item.equipment.kind === 'none'
      ? null
      : (nameOf.get(equipmentKey(item)) ?? null)
  const save = useSaveCloudMeasurement(equipmentNameOf)

  if (status === 'error' && activeTanks.length === 0) {
    return (
      <EmptyState
        icon={<CloudOffIcon />}
        title="No pudimos cargar tus tanques"
        description={RETRY_HINT}
        action={{ label: 'Reintentar', onClick: () => void load(orgId) }}
      />
    )
  }
  if (status !== 'ready' && activeTanks.length === 0) {
    return (
      <Stack spacing={3} aria-busy="true" aria-label="Cargando tus tanques">
        <Skeleton
          variant="rounded"
          height={64}
          sx={{ borderRadius: `${String(radius.lg)}px` }}
        />
        <Skeleton variant="rounded" height={44} />
        <Skeleton variant="rounded" height={48} />
      </Stack>
    )
  }
  if (activeTanks.length === 0) {
    const canAdd = canWriteFleet(role)
    return (
      <EmptyState
        icon={<LocalGasStationIcon />}
        title="Agrega tus tanques para medir"
        description={
          canAdd
            ? 'Registra los tanques de tu flota con sus medidas: así calculamos cuánto combustible tienen.'
            : 'Cuando tu equipo agregue tanques en Flota, podrás medirlos aquí.'
        }
        {...(canAdd && {
          action: {
            label: 'Agregar tanque',
            onClick: () => {
              navigate('/flota/tanques/nuevo')
            },
          },
        })}
      />
    )
  }

  const truck = tank ? rangeTruckFor(tank, trucks, trailers) : null

  return (
    <>
      <ModeToggle mode={mode} onChange={setMode} />
      <Stack spacing={3}>
        <AutocompleteBase
          id="measureEquipment"
          label="Equipo"
          placeholder="Elige el equipo"
          options={equipmentOptions}
          value={equipment ?? ''}
          onChange={value => {
            setChosenEquipment(value)
            setChosenTank(null)
          }}
        />
      </Stack>

      {tanksOfEquipment.length > 0 && (
        <TankCard
          tank={tank}
          tanks={tanksOfEquipment}
          onChoose={setChosenTank}
        />
      )}
      {tank && (
        <>
          {mode === 'measure' ? (
            // A different tank is a new form: fresh values and limits
            <MeasureForm
              key={tank.id}
              tank={tank}
              truck={truck}
              canSave={canWriteFleet(role)}
              save={save}
              onSaved={() => {
                rememberTank(orgId, tank.id)
              }}
            />
          ) : (
            <CloudRefuel
              key={tank.id}
              tank={tank}
              tanks={activeTanks}
              truck={
                tank.equipment.kind === 'truck'
                  ? (trucks.find(item => item.id === tank.equipment.id) ?? null)
                  : null
              }
              equipmentName={equipmentNameOf}
            />
          )}
        </>
      )}
    </>
  )
}
