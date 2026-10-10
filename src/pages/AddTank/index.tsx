import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation } from 'wouter'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TankFields from 'components/TankFields'
import {
  TANK_LIMITS,
  tankFormSchema,
  tankFromForm,
  type TankFormValues,
} from 'schemas/tank'
import { EMPTY_TANK_MEASURES } from 'schemas/tankMeasures'
import { TankAlreadyExistsError } from 'services/tanks'
import { useSelectedTankStore } from 'store/selectedTank'
import { useTanksStore } from 'store/tanks'
import type { Tank } from 'types'
import { reportError } from 'utils/reportError'

// Long enough to read the toast and reach its button
const DUPLICATE_NOTICE_MS = 10_000

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
    defaultValues: EMPTY_TANK_MEASURES,
  })
  const values = useWatch({ control }) as TankFormValues

  const chooseTank = (tank: Tank) => {
    selectTank(tank)
    navigate('/')
  }

  // isSubmitting disables the button until this resolves: one save per tap (§8.6)
  const onSubmit = async (values: TankFormValues) => {
    const dimensions = tankFromForm(values)

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
      <Typography variant="pageTitle">Agrega tu tanque</Typography>
      <Typography variant="body2" sx={{ mt: 1, mb: 6 }}>
        Encuentra las medidas en la placa del tanque o tómalas con una cinta
        métrica.
      </Typography>

      <Box
        component="form"
        noValidate
        aria-label="Nuevo tanque"
        onSubmit={event => {
          void handleSubmit(onSubmit)(event)
        }}
      >
        {/* The same fields as the fleet's tank (specs/0019 RF-5) */}
        <Stack spacing={5}>
          <TankFields
            control={control}
            register={register}
            errors={errors}
            values={values}
            limits={TANK_LIMITS}
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
