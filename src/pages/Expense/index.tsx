import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation, useParams } from 'wouter'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import AutocompleteField from 'components/AutocompleteField'
import { useCreateDialogs } from 'components/CreateDialogs'
import ConfirmDialog from 'components/ConfirmDialog'
import DateTimeField from 'components/DateTimeField'
import EmptyState from 'components/EmptyState'
import MoreDetails, {
  countFilled,
  useMoreDetails,
} from 'components/MoreDetails'
import NumberField from 'components/NumberField'
import PhotoField from 'components/PhotoField'
import SelectField from 'components/SelectField'
import SessionGate from 'components/SessionGate'
import TextField from 'components/TextField'
import { useExpense } from 'hooks/useExpense'
import { useTrip } from 'hooks/useTrip'
import type { Currency } from 'schemas/account'
import {
  EMPTY_EXPENSE_FORM,
  EXPENSE_KIND_LABELS,
  EXPENSE_KINDS,
  EXPENSE_LIMITS,
  expenseFormSchema,
  expenseFromForm,
  expenseToForm,
  TRIP_NOT_AT_HAND,
  tripIsAtHand,
  type Expense,
  type ExpenseFormValues,
} from 'schemas/expenses'
import type { Trip } from 'schemas/trips'
import {
  createExpense,
  deleteExpense,
  newExpenseId,
  updateExpense,
  uploadReceipt,
} from 'services/expenses'
import { photoUrl } from 'services/fleet'
import { useExpensesStore } from 'store/expenses'
import { useFleetStore } from 'store/fleet'
import { useTripsStore } from 'store/trips'
import {
  recoverFromLostPermission,
  selectActiveRole,
  useSessionStore,
} from 'store/session'
import { currencySymbol } from 'utils/formatMoney'
import { reportError } from 'utils/reportError'
import { canWriteFleet } from 'utils/roles'
import { RETRY_HINT } from 'utils/withTimeout'
import RefuelExpenseForm from './RefuelExpenseForm'
import TripDialog from 'pages/TripEditor/TripDialog'
import { tripOption, useTripChoices } from './useTripChoices'

const FORM_ID = 'expense-form'

// Behind "Ver más detalles" (specs/0026 RF-10); the description is in
// sight (specs/0036)
const DETAILS = ['driverId'] as const

const KIND_OPTIONS = EXPENSE_KINDS.map(kind => ({
  value: kind,
  label: EXPENSE_KIND_LABELS[kind],
}))

interface ExpenseFormProps {
  expense: Expense | null
  id: string
  orgId: string
  currency: Currency
  canWrite: boolean
  /** The trip it comes from ("Agregar gasto" on a trip). */
  presetTrip: Trip | null
  /** Where it goes after saving or deleting. */
  backTo: string
}

function ExpenseForm({
  expense,
  id,
  orgId,
  currency,
  canWrite,
  presetTrip,
  backTo,
}: ExpenseFormProps) {
  const [, navigate] = useLocation()
  const { trucks, trailers, drivers } = useFleetStore()
  const categories = useExpensesStore(state => state.categories)
  const tripsKnown = useTripsStore(state => state.known)
  const save = useExpensesStore(state => state.save)
  const remove = useExpensesStore(state => state.remove)
  const remember = useExpensesStore(state => state.remember)
  const uid = useSessionStore(state => state.user?.uid ?? '')
  const [now] = useState(() => new Date())
  // "+ Crear …" in each list (backend specs/0028)
  const { create, dialog } = useCreateDialogs(orgId)
  // "+ Crear viaje": its whole form, full screen (specs/0031 RF-3)
  const [newTrip, setNewTrip] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [receiptPath, setReceiptPath] = useState(
    expense?.receiptPhotoPath ?? null
  )
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: expense
      ? expenseToForm(expense)
      : EMPTY_EXPENSE_FORM(now, presetTrip?.id ?? null),
    disabled: !canWrite,
  })
  const values = useWatch({ control })
  const details = useMoreDetails<ExpenseFormValues>(DETAILS, setFocus)
  const day = values.takenAt?.slice(0, 10) ?? null
  const [ownTrip] = useTrip(expense?.tripId ?? null)
  // The trips near its date, and the one it has or comes from
  const { choices: tripChoices, loading: tripsLoading } = useTripChoices(
    orgId,
    values.kind === 'trip' ? day : null,
    [
      presetTrip,
      ownTrip.status === 'ready' ? ownTrip.trip : null,
      // The one chosen stays offered when the date moves away (audit 0027)
      values.tripId ? (tripsKnown[values.tripId] ?? null) : null,
    ]
  )

  const active = <T extends { id: string; archived: boolean }>(
    items: readonly T[],
    keep: string | null | undefined
  ) => items.filter(item => !item.archived || item.id === keep)
  const option = (item: { id: string; name: string }) => ({
    value: item.id,
    label: item.name,
  })

  const onSubmit = (values: ExpenseFormValues) => {
    const trip =
      values.kind === 'trip'
        ? (tripChoices.find(item => item.id === values.tripId) ?? null)
        : null
    if (!tripIsAtHand(values, trip, expense)) {
      setError('tripId', { message: TRIP_NOT_AT_HAND }, { shouldFocus: true })
      return
    }
    const fields = expenseFromForm(
      values,
      { currency, categories, trucks, trailers, drivers },
      trip,
      expense
    )
    const saved: Expense = {
      id,
      orgId,
      ...fields,
      // The photo as it is now, if it was uploaded while editing
      receiptPhotoPath:
        useExpensesStore.getState().known[id]?.receiptPhotoPath ?? receiptPath,
      refuelId: null,
      createdAt: expense?.createdAt ?? null,
      createdBy: expense?.createdBy ?? uid,
    }
    save(saved, () =>
      expense ? updateExpense(id, fields) : createExpense(id, orgId, fields)
    ).catch((error: unknown) => {
      reportError(error, { operation: 'saveExpense' })
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: 'No pudimos guardar el gasto',
        description: 'Revisa los datos y vuelve a intentarlo.',
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

  const confirmDelete = () => {
    setConfirming(false)
    remove(id, () => deleteExpense(id)).catch((error: unknown) => {
      reportError(error, { operation: 'deleteExpense' })
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: 'No pudimos borrar el gasto',
        description: 'Vuelve a intentarlo.',
      })
    })
    sileo.success({ title: 'Gasto borrado' })
    navigate(backTo)
  }

  return (
    <>
      <Box
        component="form"
        id={FORM_ID}
        noValidate
        aria-label="Datos del gasto"
        onSubmit={event => {
          void handleSubmit(onSubmit, details.onInvalid)(event)
        }}
      >
        <Stack spacing={5}>
          <DateTimeField
            id="expenseTakenAt"
            label="Fecha y hora"
            control={control}
            name="takenAt"
            error={errors.takenAt?.message}
            disabled={!canWrite}
          />
          <NumberField
            id="expenseAmount"
            label="Monto"
            prefix={currencySymbol(
              expense?.currency ??
                (values.kind === 'trip'
                  ? tripChoices.find(item => item.id === values.tripId)
                      ?.currency
                  : undefined) ??
                currency
            )}
            placeholder="1,850"
            error={errors.amount?.message}
            registration={register('amount')}
          />
          <AutocompleteField
            id="expenseCategory"
            label="Categoría"
            options={active(categories, expense?.categoryId).map(option)}
            placeholder="Elige la categoría"
            error={errors.categoryId?.message}
            control={control}
            name="categoryId"
            create={{
              label: 'Crear categoría',
              onCreate: text => {
                create('category', text, id => {
                  setValue('categoryId', id, { shouldValidate: true })
                })
              },
            }}
            disabled={!canWrite}
          />
          {/* What it was, in sight: fundamental (specs/0036) */}
          <TextField
            id="expenseDescription"
            label="Descripción (opcional)"
            placeholder="Peaje de Tipitapa"
            maxLength={EXPENSE_LIMITS.description}
            error={errors.description?.message}
            registration={register('description')}
          />
          <SelectField
            id="expenseKind"
            label="Corresponde a"
            options={KIND_OPTIONS}
            control={control}
            name="kind"
            disabled={!canWrite}
          />
          {values.kind === 'trip' && (
            <AutocompleteField
              id="expenseTrip"
              label="Viaje"
              options={tripChoices.map(tripOption)}
              placeholder={tripsLoading ? 'Buscando viajes…' : 'Busca el viaje'}
              hint="Los que empezaron hasta 30 días antes o después de la fecha."
              error={errors.tripId?.message}
              control={control}
              name="tripId"
              disabled={!canWrite}
              create={{
                label: 'Crear viaje',
                withText: false,
                onCreate: () => {
                  setNewTrip(true)
                },
              }}
            />
          )}
          {values.kind === 'truck' && (
            <AutocompleteField
              id="expenseTruck"
              label="Camión"
              options={active(trucks, expense?.truckId).map(option)}
              placeholder="Elige el camión"
              error={errors.truckId?.message}
              control={control}
              name="truckId"
              create={{
                label: 'Crear camión',
                onCreate: text => {
                  create('truck', text, id => {
                    setValue('truckId', id, { shouldValidate: true })
                  })
                },
              }}
              disabled={!canWrite}
            />
          )}
          {values.kind === 'trailer' && (
            <AutocompleteField
              id="expenseTrailer"
              label="Remolque"
              options={active(trailers, expense?.trailerId).map(option)}
              placeholder="Elige el remolque"
              error={errors.trailerId?.message}
              control={control}
              name="trailerId"
              create={{
                label: 'Crear remolque',
                onCreate: text => {
                  create('trailer', text, id => {
                    setValue('trailerId', id, { shouldValidate: true })
                  })
                },
              }}
              disabled={!canWrite}
            />
          )}
          <MoreDetails
            open={details.open}
            onToggle={details.toggle}
            filled={countFilled([values.driverId])}
          >
            <AutocompleteField
              id="expenseDriver"
              label="Conductor (opcional)"
              options={[
                { value: '', label: 'Sin conductor' },
                ...active(drivers, expense?.driverId).map(option),
              ]}
              control={control}
              name="driverId"
              create={{
                label: 'Crear conductor',
                onCreate: text => {
                  create('driver', text, id => {
                    setValue('driverId', id, { shouldValidate: true })
                  })
                },
              }}
              disabled={!canWrite}
            />
          </MoreDetails>
          {canWrite && (
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              loading={isSubmitting}
              loadingPosition="start"
            >
              {expense ? 'Guardar cambios' : 'Guardar gasto'}
            </Button>
          )}
        </Stack>
      </Box>

      {expense ? (
        <Box sx={{ mt: 8 }}>
          <PhotoField
            alt="Foto del comprobante"
            label="Foto del comprobante"
            path={receiptPath}
            loadUrl={photoUrl}
            upload={file => uploadReceipt(orgId, id, file)}
            kind="expenseReceipt"
            onUploaded={path => {
              setReceiptPath(path)
              // Opened again, it shows the photo it now has; on what is
              // known now, not this screen's copy, or a save made while it
              // uploaded would go back (audit 2026-10-09)
              const known = useExpensesStore.getState().known[id] ?? expense
              remember([{ ...known, receiptPhotoPath: path }])
            }}
            disabled={!canWrite}
          />
        </Box>
      ) : (
        canWrite && (
          <Typography
            variant="caption"
            component="p"
            sx={{ mt: 4, color: 'text.secondary' }}
          >
            Después de guardarlo podrás agregarle la foto del comprobante.
          </Typography>
        )
      )}

      {expense && canWrite && (
        <Button
          variant="outlined"
          size="large"
          color="error"
          fullWidth
          startIcon={<DeleteOutlineIcon />}
          onClick={() => {
            setConfirming(true)
          }}
          sx={{ mt: 8 }}
        >
          Borrar
        </Button>
      )}
      {dialog}
      {newTrip && (
        <TripDialog
          orgId={orgId}
          currency={currency}
          onSaved={trip => {
            setValue('tripId', trip.id, { shouldValidate: true })
          }}
          onClose={() => {
            setNewTrip(false)
          }}
        />
      )}
      <ConfirmDialog
        open={confirming}
        title="¿Borrar este gasto?"
        description="No se puede deshacer."
        confirmLabel="Borrar"
        onConfirm={confirmDelete}
        onClose={() => {
          setConfirming(false)
        }}
      />
    </>
  )
}

function ExpenseScreen() {
  const params = useParams<{ id?: string }>()
  const [, navigate] = useLocation()
  const isNew = params.id === 'nuevo'
  // The new expense's id exists from the moment the form opens (ADR 0003)
  const [newId] = useState(newExpenseId)
  const id = isNew ? newId : (params.id ?? newId)
  // Opened from a trip: it goes back there (audit 0027); a new one also
  // comes with that trip chosen
  const fromTrip = new URLSearchParams(window.location.search).get('viaje')
  const tripIdParam = isNew ? fromTrip : null
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const currency = useSessionStore(
    state => state.organization?.defaultCurrency ?? 'USD'
  )
  const role = useSessionStore(selectActiveRole)
  const canWrite = canWriteFleet(role)
  const fleetStatus = useFleetStore(state => state.status)
  const loadFleet = useFleetStore(state => state.load)
  const categoriesStatus = useExpensesStore(state => state.categoriesStatus)
  const loadCategories = useExpensesStore(state => state.loadCategories)
  const [loaded, retry] = useExpense(isNew ? null : id)
  const [presetTrip] = useTrip(tripIdParam)

  useEffect(() => {
    if (!orgId) return
    void loadFleet(orgId)
    void loadCategories(orgId)
  }, [orgId, loadFleet, loadCategories])

  const back = fromTrip ? `/viajes/${fromTrip}` : '/gastos'
  const notFound = (
    <EmptyState
      icon={<SearchOffIcon />}
      title="No encontramos ese gasto"
      description="Puede que lo hayan borrado o que pertenezca a otra organización."
      action={{
        label: 'Ver gastos',
        onClick: () => {
          navigate('/gastos')
        },
      }}
    />
  )

  const body = () => {
    if (isNew && !canWrite) {
      return (
        <EmptyState
          icon={<SearchOffIcon />}
          title="No puedes agregar gastos"
          description="Tu rol en la organización es de solo lectura."
          action={{
            label: 'Ver gastos',
            onClick: () => {
              navigate('/gastos')
            },
          }}
        />
      )
    }
    if (!isNew && loaded.status === 'missing') return notFound
    if (
      (!isNew && loaded.status === 'error') ||
      fleetStatus === 'error' ||
      categoriesStatus === 'error'
    ) {
      return (
        <EmptyState
          icon={<CloudOffIcon />}
          title="No pudimos cargar el gasto"
          description={RETRY_HINT}
          action={{
            label: 'Reintentar',
            onClick: () => {
              if (loaded.status === 'error') retry()
              // Without them the form never shows (audit 0027)
              if (fleetStatus === 'error') void loadFleet(orgId)
              if (categoriesStatus === 'error') void loadCategories(orgId)
            },
          }}
        />
      )
    }
    if (
      fleetStatus !== 'ready' ||
      categoriesStatus !== 'ready' ||
      (!isNew && loaded.status !== 'ready') ||
      (tripIdParam !== null && presetTrip.status === 'loading')
    ) {
      return (
        <Box aria-busy="true" aria-label="Cargando">
          <Skeleton variant="rounded" height={320} />
        </Box>
      )
    }
    // A refuel's has its own form (specs/0027 RF-9)
    if (loaded.status === 'ready' && !isNew && loaded.expense.refuelId) {
      return (
        <RefuelExpenseForm
          key={id}
          expense={{ ...loaded.expense, refuelId: loaded.expense.refuelId }}
          orgId={orgId}
          canWrite={canWrite}
          backTo={back}
        />
      )
    }
    return (
      <ExpenseForm
        key={id}
        expense={loaded.status === 'ready' && !isNew ? loaded.expense : null}
        id={id}
        orgId={orgId}
        currency={currency}
        canWrite={canWrite}
        presetTrip={presetTrip.status === 'ready' ? presetTrip.trip : null}
        backTo={back}
      />
    )
  }

  return (
    <Box component="main" sx={{ px: 4, pt: 2, pb: 8 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => {
          navigate(back)
        }}
        sx={{ ml: -2, mb: 2 }}
      >
        {fromTrip ? 'Viaje' : 'Gastos'}
      </Button>
      <Typography variant="pageTitle" sx={{ mb: 6 }}>
        {isNew ? 'Nuevo gasto' : 'Gasto'}
      </Typography>
      {body()}
    </Box>
  )
}

export default function ExpensePage() {
  return (
    <SessionGate needs="ready">
      <ExpenseScreen />
    </SessionGate>
  )
}
