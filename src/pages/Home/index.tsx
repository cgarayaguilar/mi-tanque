import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation } from 'wouter'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import InputAdornment from '@mui/material/InputAdornment'
import OutlinedInput from '@mui/material/OutlinedInput'
import Step from '@mui/material/Step'
import StepContent from '@mui/material/StepContent'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import Typography from '@mui/material/Typography'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import EmptyState from 'components/EmptyState'
import FuelGauge from 'components/FuelGauge'
import NavBar from 'components/NavBar'
import Stat from 'components/Stat'
import TankCard from 'components/TankCard'
import { useSaveMeasurement } from 'hooks/useSaveMeasurement'
import {
  measurementFormSchema,
  type MeasurementFormValues,
} from 'schemas/measurementForm'
import { useSelectedTankStore } from 'store/selectedTank'
import { layout } from 'theme/tokens'
import type { FuelReading, Tank } from 'types'
import { calculateReading } from 'utils/fuelReading'
import { parseDecimal } from 'utils/parseDecimal'

const NOT_MEASURED = '—'

function Results({ reading }: { reading: FuelReading | null }) {
  return (
    <Box component="section" aria-labelledby="results-title" sx={{ mt: 8 }}>
      <Typography id="results-title" variant="h3" component="h2">
        Resultados
      </Typography>
      {reading === null && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Ingresa las pulgadas y calcula para ver cuánto combustible tienes.
        </Typography>
      )}
      <Box
        aria-live="polite"
        sx={{ display: 'flex', justifyContent: 'space-between', py: 4 }}
      >
        <Stat label="Pulgadas" value={reading?.inches ?? NOT_MEASURED} />
        <Stat label="Galones" value={reading?.gallons ?? NOT_MEASURED} />
        <Stat label="Litros" value={reading?.liters ?? NOT_MEASURED} />
      </Box>
      <FuelGauge reading={reading} />
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
  const { ref: inchesRef, ...inchesField } = register('inches')

  const onSubmit = async ({ inches }: MeasurementFormValues) => {
    const next = calculateReading(tank, parseDecimal(inches))
    setReading(next)
    await saveMeasurement(tank, next)
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
      >
        <Stepper orientation="vertical" activeStep={1}>
          <Step completed expanded>
            <StepLabel>Elige tu tanque</StepLabel>
            <StepContent>
              <TankCard
                tank={tank}
                actionLabel="Cambiar tanque"
                onClick={onChangeTank}
              />
            </StepContent>
          </Step>
          <Step expanded>
            <StepLabel>Mide el combustible</StepLabel>
            <StepContent>
              <FormControl fullWidth error={errors.inches !== undefined}>
                <FormLabel htmlFor="inches">Pulgadas de combustible</FormLabel>
                <OutlinedInput
                  id="inches"
                  placeholder="Ej. 12,5"
                  inputRef={inchesRef}
                  {...inchesField}
                  endAdornment={
                    <InputAdornment position="end">pulg.</InputAdornment>
                  }
                  slotProps={{
                    input: {
                      inputMode: 'decimal',
                      autoComplete: 'off',
                      'aria-describedby': 'inches-help',
                    },
                  }}
                />
                <FormHelperText id="inches-help">
                  {errors.inches?.message ??
                    `Entre 0 y ${String(tank.diameter)}, el diámetro de tu tanque.`}
                </FormHelperText>
              </FormControl>
            </StepContent>
          </Step>
          <Step expanded>
            <StepLabel>Calcula el nivel</StepLabel>
            <StepContent>
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
            </StepContent>
          </Step>
        </Stepper>
      </Box>

      <Results reading={reading} />
    </>
  )
}

export default function Home() {
  const selectedTank = useSelectedTankStore(state => state.selectedTank)
  const [, navigate] = useLocation()

  const chooseTank = () => {
    navigate('/tanques')
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: `calc(100vh - ${String(layout.appBarHeight)}px)`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: 4, flexGrow: 1 }}>
        {selectedTank ? (
          // A different tank is a new form (fresh values and intent)
          <Measurement
            key={selectedTank.id}
            tank={selectedTank}
            onChangeTank={chooseTank}
          />
        ) : (
          <EmptyState
            icon={<LocalGasStationIcon />}
            title="Elige tu tanque para empezar"
            description="Necesitamos sus medidas para calcular cuánto combustible tiene."
            action={{ label: 'Elegir tanque', onClick: chooseTank }}
          />
        )}
      </Box>
      <Box sx={{ px: 4, pb: 4 }}>
        <NavBar activeTab={2} />
      </Box>
    </Box>
  )
}
