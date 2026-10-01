import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation } from 'wouter'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import NativeSelect from '@mui/material/NativeSelect'
import OutlinedInput from '@mui/material/OutlinedInput'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import EmptyState from 'components/EmptyState'
import ModeToggle, { type MeasureMode } from 'components/ModeToggle'
import CloudRefuel from 'pages/Home/CloudRefuel'
import FuelGauge from 'components/FuelGauge'
import NumberField from 'components/NumberField'
import Stat from 'components/Stat'
import TankShapeIcon from 'components/TankShapeIcon'
import { useSaveCloudMeasurement } from 'hooks/useSaveCloudMeasurement'
import { KM_PER_MILE, type FleetTank, type Truck } from 'schemas/fleet'
import {
  cloudMeasurementFormSchema,
  type CloudMeasurementFormValues,
} from 'schemas/measurementForm'
import { useFleetStore } from 'store/fleet'
import { selectActiveRole, useSessionStore } from 'store/session'
import { radius } from 'theme/tokens'
import { tankMeasures } from 'utils/fleetLabels'
import { formatNumber } from 'utils/formatNumber'
import {
  maxInchesFor,
  rangeTruckFor,
  readingFor,
  type CloudReading,
} from 'utils/measurementMath'
import { parseDecimal } from 'utils/parseDecimal'
import { reportError } from 'utils/reportError'
import { canWriteFleet } from 'utils/roles'

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
}: {
  reading: CloudReading | null
  truck: Truck | null
}) {
  const unit = truck?.distanceUnit ?? 'km'
  const range = reading?.estimate
    ? unit === 'mi'
      ? `${formatNumber(Math.round(reading.estimate.miles))} mi (${formatNumber(Math.round(reading.estimate.km))} km)`
      : `${formatNumber(Math.round(reading.estimate.km))} km (${formatNumber(Math.round(reading.estimate.miles))} mi)`
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
          {range
            ? `Alcanza para unos ${range}.`
            : truck
              ? `Agrega el rendimiento de ${truck.name} para estimar la distancia.`
              : 'Este tanque no es de un camión: no hay estimación de distancia.'}
        </Typography>
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
  save: (
    tank: FleetTank,
    reading: CloudReading,
    odometerKm: number | null
  ) => void
}) {
  const [reading, setReading] = useState<CloudReading | null>(null)
  const maxInches = maxInchesFor(tank)
  const odometerUnit = truck?.distanceUnit ?? 'km'
  const asksOdometer = tank.equipment.kind === 'truck' && truck !== null
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CloudMeasurementFormValues>({
    resolver: zodResolver(cloudMeasurementFormSchema(maxInches)),
    defaultValues: { inches: '', odometer: '' },
  })

  const onSubmit = ({ inches, odometer }: CloudMeasurementFormValues) => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
    const next = readingFor(
      tank,
      parseDecimal(inches),
      truck?.fuelEfficiencyKmPerGal ?? null
    )
    setReading(next)
    if (!canSave) return
    const odometerKm =
      asksOdometer && odometer.trim() !== ''
        ? Math.round(
            parseDecimal(odometer) * (odometerUnit === 'mi' ? KM_PER_MILE : 1)
          )
        : null
    save(tank, next, odometerKm)
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
          placeholder="Ej. 12,5"
          hint={`Entre 0 y ${formatNumber(maxInches)}.`}
          error={errors.inches?.message}
          registration={register('inches')}
        />
        {asksOdometer && (
          <NumberField
            id="odometer"
            label="Odómetro (opcional)"
            unit={odometerUnit}
            placeholder="Ej. 120500"
            hint={`El de ${truck.name}, si lo tienes a mano.`}
            error={errors.odometer?.message}
            registration={register('odometer')}
          />
        )}
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
      <CloudResults reading={reading} truck={truck} />
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
        description="Revisa tu conexión y vuelve a intentarlo."
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
        <FormControl fullWidth>
          <FormLabel htmlFor="measureEquipment">Equipo</FormLabel>
          <NativeSelect
            input={<OutlinedInput />}
            value={equipment ?? ''}
            inputProps={{ id: 'measureEquipment' }}
            onChange={event => {
              setChosenEquipment(event.target.value)
              setChosenTank(null)
            }}
          >
            {equipmentOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </FormControl>
        {tanksOfEquipment.length > 1 && (
          <FormControl fullWidth>
            <FormLabel htmlFor="measureTank">Tanque</FormLabel>
            <NativeSelect
              input={<OutlinedInput />}
              value={tank?.id ?? ''}
              inputProps={{ id: 'measureTank' }}
              onChange={event => {
                setChosenTank(event.target.value)
              }}
            >
              {!tank && <option value="">Elige el tanque</option>}
              {tanksOfEquipment.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
        )}
      </Stack>

      {tank && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              mt: 4,
              px: 4,
              py: 3,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: `${String(radius.lg)}px`,
            }}
          >
            <TankShapeIcon shape={tank.shape} size={36} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" component="p" noWrap>
                {tank.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {tankMeasures(tank)} · {formatNumber(tank.capacityGal)} gal
              </Typography>
            </Box>
          </Box>
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
