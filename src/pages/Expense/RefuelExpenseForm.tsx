import { useEffect, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation } from 'wouter'
import { sileo } from 'sileo'
import { format } from 'date-fns'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import AutocompleteField from 'components/AutocompleteField'
import ChoiceButtons from 'components/ChoiceButtons'
import EmptyState from 'components/EmptyState'
import PhotoField from 'components/PhotoField'
import TextField from 'components/TextField'
import { useTrip } from 'hooks/useTrip'
import {
  EXPENSE_KIND_LABELS,
  EXPENSE_LIMITS,
  refuelBaseKind,
  refuelExpenseChanges,
  refuelExpenseFormSchema,
  tripCarriesRefuel,
  TRIP_NOT_AT_HAND,
  tripIsAtHand,
  type Expense,
  type RefuelExpenseFormValues,
  type RefuelOfExpense,
} from 'schemas/expenses'
import { readRefuelOfExpense, updateRefuelExpense } from 'services/expenses'
import { photoUrl } from 'services/fleet'
import { useExpensesStore } from 'store/expenses'
import { useFleetStore } from 'store/fleet'
import { recoverFromLostPermission } from 'store/session'
import { formatMeasurementDate } from 'utils/formatDate'
import { moneyTotal } from 'utils/formatMoney'
import { reportError } from 'utils/reportError'
import { RETRY_HINT } from 'utils/withTimeout'
import { tripOption, useTripChoices } from './useTripChoices'

const FORM_ID = 'refuel-expense-form'

type RefuelState =
  | { status: 'loading' }
  | { status: 'ready'; refuel: RefuelOfExpense }
  | { status: 'error' }

/** The refuel behind the expense, read once. */
const useRefuelOfExpense = (refuelId: string): [RefuelState, () => void] => {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    refuelId: string
    attempt: number
    value: RefuelState
  } | null>(null)
  useEffect(() => {
    let current = true
    readRefuelOfExpense(refuelId)
      .then(refuel => {
        if (!current) return
        setState({
          refuelId,
          attempt,
          value: refuel ? { status: 'ready', refuel } : { status: 'error' },
        })
      })
      .catch((error: unknown) => {
        reportError(error, { operation: 'readRefuelOfExpense' })
        if (current) setState({ refuelId, attempt, value: { status: 'error' } })
      })
    return () => {
      current = false
    }
  }, [refuelId, attempt])
  return [
    state?.refuelId === refuelId && state.attempt === attempt
      ? state.value
      : { status: 'loading' },
    () => {
      setAttempt(value => value + 1)
    },
  ]
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography
        variant="caption"
        component="p"
        sx={{ color: 'text.secondary' }}
      >
        {label}
      </Typography>
      <Typography variant="body1" component="div">
        {children}
      </Typography>
    </Box>
  )
}

interface RefuelExpenseFormProps {
  expense: Expense & { refuelId: string }
  orgId: string
  canWrite: boolean
  /** Where it goes after saving. */
  backTo: string
}

/**
 * A refuel's expense (backend specs/0027 RF-9): its amount, date and
 * category follow the refuel; here only what it belongs to and its
 * description change.
 */
export default function RefuelExpenseForm({
  expense,
  orgId,
  canWrite,
  backTo,
}: RefuelExpenseFormProps) {
  const [, navigate] = useLocation()
  const { trucks, trailers } = useFleetStore()
  const categories = useExpensesStore(state => state.categories)
  const save = useExpensesStore(state => state.save)
  const [loaded, retryRefuel] = useRefuelOfExpense(expense.refuelId)
  const refuel = loaded.status === 'ready' ? loaded.refuel : null
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RefuelExpenseFormValues>({
    resolver: zodResolver(refuelExpenseFormSchema),
    defaultValues: {
      kind: expense.kind,
      tripId: expense.tripId ?? '',
      description: expense.description ?? '',
    },
    disabled: !canWrite,
  })
  const values = useWatch({ control })
  const [ownTrip] = useTrip(expense.tripId)
  const { choices, loading } = useTripChoices(
    orgId,
    values.kind === 'trip' ? format(expense.takenAt, 'yyyy-MM-dd') : null,
    [ownTrip.status === 'ready' ? ownTrip.trip : null]
  )

  if (loaded.status === 'loading') {
    return (
      <Box aria-busy="true" aria-label="Cargando">
        <Skeleton variant="rounded" height={240} />
      </Box>
    )
  }

  // Without its refuel it is not known what it can belong to (audit 0027)
  if (loaded.status === 'error' || !refuel) {
    return (
      <EmptyState
        icon={<CloudOffIcon />}
        title="No pudimos cargar el relleno de este gasto"
        description={RETRY_HINT}
        action={{ label: 'Reintentar', onClick: retryRefuel }}
      />
    )
  }

  const equipment = refuel.equipment
  const baseKind = refuelBaseKind(equipment)
  // Only the trips that carry its truck or trailer (RF-6)
  const trips = choices.filter(trip => tripCarriesRefuel(trip, equipment))
  const equipmentName =
    (equipment.kind === 'truck' ? trucks : trailers).find(
      item => item.id === equipment.id
    )?.name ??
    (equipment.kind === 'truck' ? expense.truckName : expense.trailerName)
  const category =
    categories.find(item => item.id === expense.categoryId)?.name ??
    expense.categoryName

  const onSubmit = (values: RefuelExpenseFormValues) => {
    const trip =
      values.kind === 'trip'
        ? (trips.find(item => item.id === values.tripId) ?? null)
        : null
    if (!tripIsAtHand(values, trip, expense)) {
      setError('tripId', { message: TRIP_NOT_AT_HAND }, { shouldFocus: true })
      return
    }
    const changes = refuelExpenseChanges(
      values,
      refuel,
      trip,
      equipmentName,
      expense
    )
    save({ ...expense, ...changes }, () =>
      updateRefuelExpense(expense.id, changes)
    ).catch((error: unknown) => {
      reportError(error, { operation: 'saveRefuelExpense' })
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: 'No pudimos guardar el gasto',
        description: 'Vuelve a intentarlo.',
      })
    })
    sileo.success({
      title: 'Gasto guardado',
      ...(!navigator.onLine && {
        description: 'Se subirá cuando tengas señal.',
      }),
    })
    navigate(backTo)
  }

  return (
    <>
      <Alert severity="info" sx={{ mb: 6 }}>
        Este gasto es de un relleno de {refuel.tankName}. El monto, la fecha y
        la categoría se cambian en el relleno, en Historial.
      </Alert>
      <Stack spacing={4} sx={{ mb: 6 }}>
        <Line label="Fecha y hora">
          {formatMeasurementDate(expense.takenAt)}
        </Line>
        <Line label="Monto">
          {moneyTotal(expense.currency, expense.amount)}
        </Line>
        <Line label="Categoría">{category}</Line>
      </Stack>
      <Box
        component="form"
        id={FORM_ID}
        noValidate
        aria-label="Datos del gasto"
        onSubmit={event => {
          void handleSubmit(onSubmit)(event)
        }}
      >
        <Stack spacing={5}>
          {/* A tank without equipment: its refuel stays general */}
          {baseKind === 'general' ? (
            <Line label="Corresponde a">{EXPENSE_KIND_LABELS.general}</Line>
          ) : (
            <ChoiceButtons
              id="refuelExpenseKind"
              label="Corresponde a"
              options={[
                { value: 'trip', label: EXPENSE_KIND_LABELS.trip },
                { value: baseKind, label: EXPENSE_KIND_LABELS[baseKind] },
              ]}
              control={control}
              name="kind"
              disabled={!canWrite}
            />
          )}
          {values.kind === 'trip' && (
            <AutocompleteField
              id="refuelExpenseTrip"
              label="Viaje"
              options={trips.map(tripOption)}
              placeholder={loading ? 'Buscando viajes…' : 'Busca el viaje'}
              hint={`Los de ${equipmentName ?? 'su equipo'} que empezaron hasta 30 días antes o después.`}
              error={errors.tripId?.message}
              control={control}
              name="tripId"
              disabled={!canWrite}
            />
          )}
          <TextField
            id="refuelExpenseDescription"
            label="Descripción (opcional)"
            placeholder="Diésel en Puma Km 7"
            maxLength={EXPENSE_LIMITS.description}
            error={errors.description?.message}
            registration={register('description')}
          />
          {canWrite && (
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              loading={isSubmitting}
              loadingPosition="start"
            >
              Guardar cambios
            </Button>
          )}
        </Stack>
      </Box>
      {expense.receiptPhotoPath && (
        <Box sx={{ mt: 8 }}>
          <PhotoField
            alt="Foto de la factura"
            label="Foto de la factura"
            path={expense.receiptPhotoPath}
            loadUrl={photoUrl}
          />
        </Box>
      )}
    </>
  )
}
