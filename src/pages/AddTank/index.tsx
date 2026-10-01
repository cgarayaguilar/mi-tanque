import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation } from 'wouter'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import NumberField from 'components/NumberField'
import TankDiagram from 'components/TankDiagram'
import { TANK_LIMITS, tankFormSchema, type TankFormValues } from 'schemas/tank'
import { TankAlreadyExistsError } from 'services/tanks'
import { useSelectedTankStore } from 'store/selectedTank'
import { useTanksStore } from 'store/tanks'
import { radius } from 'theme/tokens'
import type { Tank } from 'types'
import { parseDecimal } from 'utils/parseDecimal'
import { reportError } from 'utils/reportError'

const EMPTY_FORM: TankFormValues = { capacity: '', diameter: '', length: '' }
// Long enough to read the toast and reach its button
const DUPLICATE_NOTICE_MS = 10_000

const rangeHint = (dimension: keyof typeof TANK_LIMITS) => {
  const { min, max, unit } = TANK_LIMITS[dimension]
  return `Entre ${String(min)} y ${String(max)} ${unit}.`
}

/** The preview shows what the user typed, or a dash until they do. */
const preview = (value: string) => value.trim() || '—'

export default function AddTank() {
  const addTank = useTanksStore(state => state.addTank)
  const selectTank = useSelectedTankStore(state => state.selectTank)
  const [, navigate] = useLocation()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TankFormValues>({
    resolver: zodResolver(tankFormSchema),
    defaultValues: EMPTY_FORM,
  })
  const typed = useWatch({ control })

  const chooseTank = (tank: Tank) => {
    selectTank(tank)
    navigate('/')
  }

  // isSubmitting disables the button until this resolves: one save per tap (§8.6)
  const onSubmit = async (values: TankFormValues) => {
    const dimensions = {
      capacity: parseDecimal(values.capacity),
      diameter: parseDecimal(values.diameter),
      length: parseDecimal(values.length),
    }

    try {
      chooseTank(await addTank(dimensions))
      sileo.success({ title: 'Tanque agregado' })
    } catch (error) {
      if (error instanceof TankAlreadyExistsError) {
        const { existing } = error
        const noticeId = sileo.action({
          title: 'Ya tienes ese tanque',
          description: 'Tiene las mismas medidas que uno de tu lista.',
          duration: DUPLICATE_NOTICE_MS,
          autopilot: { expand: 0, collapse: 0 },
          button: {
            title: 'Usarlo',
            onClick: () => {
              sileo.dismiss(noticeId)
              chooseTank(existing)
            },
          },
        })
        return
      }

      reportError(error, { operation: 'createTank', ...dimensions })
      sileo.error({
        title: 'No pudimos guardar el tanque',
        description: 'Reintenta en un momento.',
      })
    }
  }

  return (
    <Box component="main" sx={{ p: 4 }}>
      <Typography variant="h3" component="h1">
        Agrega tu tanque
      </Typography>
      <Typography variant="body2" sx={{ mt: 1, mb: 6 }}>
        Encuentra las medidas en la placa del tanque o tómalas con una cinta
        métrica.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          py: 6,
          mb: 6,
          border: 1,
          borderColor: 'divider',
          borderRadius: `${String(radius.lg)}px`,
          bgcolor: 'background.paper',
        }}
      >
        <TankDiagram
          capacity={preview(typed.capacity ?? '')}
          diameter={preview(typed.diameter ?? '')}
          length={preview(typed.length ?? '')}
        />
      </Box>

      <Box
        component="form"
        noValidate
        aria-label="Nuevo tanque"
        onSubmit={event => {
          void handleSubmit(onSubmit)(event)
        }}
      >
        <Stack spacing={5}>
          <NumberField
            id="capacity"
            label="Capacidad"
            unit="gal."
            placeholder="Ej. 120"
            hint={rangeHint('capacity')}
            error={errors.capacity?.message}
            registration={register('capacity')}
          />
          <NumberField
            id="diameter"
            label="Diámetro"
            unit="pulg."
            placeholder="Ej. 24"
            hint={`${rangeHint('diameter')} Es la altura del tanque acostado.`}
            error={errors.diameter?.message}
            registration={register('diameter')}
          />
          <NumberField
            id="length"
            label="Longitud"
            unit="pulg."
            placeholder="Ej. 64"
            hint={rangeHint('length')}
            error={errors.length?.message}
            registration={register('length')}
          />
        </Stack>

        <Stack spacing={3} sx={{ mt: 8 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            loading={isSubmitting}
            loadingPosition="start"
          >
            {isSubmitting ? 'Guardando…' : 'Guardar tanque'}
          </Button>
          <Button
            variant="outlined"
            size="large"
            fullWidth
            onClick={() => {
              navigate('/tanques')
            }}
          >
            Cancelar
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}
