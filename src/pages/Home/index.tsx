import { lazy, Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation } from 'wouter'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import EmptyState from 'components/EmptyState'
import ModeToggle, { type MeasureMode } from 'components/ModeToggle'
import FuelGauge from 'components/FuelGauge'
import NavBar from 'components/NavBar'
import NumberField from 'components/NumberField'
import Stat from 'components/Stat'
import { useSaveMeasurement } from 'hooks/useSaveMeasurement'
import {
  measurementFormSchema,
  type MeasurementFormValues,
} from 'schemas/measurementForm'
import { useSelectedTankStore } from 'store/selectedTank'
import { useSessionStore } from 'store/session'
import { layout, radius } from 'theme/tokens'
import type { FuelReading, Tank } from 'types'
import { calculateReading } from 'utils/fuelReading'
import { formatNumber } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'

const NOT_MEASURED = '—'

// With a session, the organization's tanks (backend specs/0004). Lazy: its
// chunk brings the Firebase SDK, which the basic mode never downloads
const CloudMeasurement = lazy(() => import('./CloudMeasurement'))
// Refuels without an account (specs/0006): their own chunk
const BasicRefuel = lazy(() => import('./BasicRefuel'))

// Read by screen readers only: the gauge and figures speak for themselves
const visuallyHidden = {
  position: 'absolute',
  // Strings: in sx, 1 would mean 100%
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const

/** The chosen tank in one row, so the reading fits on a phone screen. */
function TankSummary({ tank, onChange }: { tank: Tank; onChange: () => void }) {
  const capacity = formatNumber(tank.capacity)
  const diameter = formatNumber(tank.diameter)
  const length = formatNumber(tank.length)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 3,
        px: 4,
        py: 3,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.lg)}px`,
      }}
    >
      <div>
        <Typography
          variant="overline"
          component="p"
          sx={{ color: 'text.secondary' }}
        >
          Tu tanque
        </Typography>
        <Typography variant="subtitle1" component="p">
          {capacity} galones
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {diameter} × {length} pulgadas
        </Typography>
      </div>
      <Button
        variant="outlined"
        onClick={onChange}
        aria-label={`Cambiar tanque: tanque de ${capacity} galones, ${diameter} por ${length} pulgadas`}
      >
        Cambiar
      </Button>
    </Box>
  )
}

function Results({ reading }: { reading: FuelReading | null }) {
  return (
    <Box component="section" aria-labelledby="results-title">
      <Typography id="results-title" component="h2" sx={visuallyHidden}>
        Resultados
      </Typography>
      <FuelGauge reading={reading} />
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
    </Box>
  )
}

interface MeasurementProps {
  tank: Tank
  onChangeTank: () => void
}

function Measurement({ tank, onChangeTank }: MeasurementProps) {
  const [reading, setReading] = useState<FuelReading | null>(null)
  const saveMeasurement = useSaveMeasurement()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MeasurementFormValues>({
    resolver: zodResolver(measurementFormSchema(tank.diameter)),
    defaultValues: { inches: '' },
  })

  const onSubmit = async ({ inches }: MeasurementFormValues) => {
    // Closes the phone keyboard so the result is in view
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
    const next = calculateReading(tank, parseDecimal(inches))
    setReading(next)
    await saveMeasurement(tank, next)
  }

  return (
    <>
      <TankSummary tank={tank} onChange={onChangeTank} />

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
          hint={`Entre 0 y ${formatNumber(tank.diameter)}, el diámetro de tu tanque.`}
          error={errors.inches?.message}
          registration={register('inches')}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          loading={isSubmitting}
          loadingPosition="start"
        >
          {isSubmitting ? 'Guardando…' : 'Calcular'}
        </Button>
      </Box>

      <Results reading={reading} />
    </>
  )
}

export default function Home() {
  const selectedTank = useSelectedTankStore(state => state.selectedTank)
  const [mode, setMode] = useState<MeasureMode>('measure')
  const sessionStatus = useSessionStore(state => state.status)
  const [, navigate] = useLocation()

  const chooseTank = () => {
    navigate('/tanques')
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
        {sessionStatus === 'ready' || sessionStatus === 'loading' ? (
          <Suspense fallback={null}>
            {sessionStatus === 'ready' && <CloudMeasurement />}
          </Suspense>
        ) : selectedTank ? (
          <>
            <ModeToggle mode={mode} onChange={setMode} />
            {mode === 'measure' ? (
              // A different tank is a new form (fresh values and intent)
              <Measurement
                key={selectedTank.id}
                tank={selectedTank}
                onChangeTank={chooseTank}
              />
            ) : (
              <Suspense fallback={null}>
                <TankSummary tank={selectedTank} onChange={chooseTank} />
                <BasicRefuel key={selectedTank.id} tank={selectedTank} />
              </Suspense>
            )}
          </>
        ) : (
          <EmptyState
            icon={<LocalGasStationIcon />}
            title="Elige tu tanque para empezar"
            description="Necesitamos sus medidas para calcular cuánto combustible tiene."
            action={{ label: 'Elegir tanque', onClick: chooseTank }}
          />
        )}
      </Box>
      <NavBar />
    </Box>
  )
}
