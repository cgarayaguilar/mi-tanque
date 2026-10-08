import { useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation } from 'wouter'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined'
import AutocompleteField from 'components/AutocompleteField'
import ChoiceButtons from 'components/ChoiceButtons'
import DateTimeField from 'components/DateTimeField'
import MoreDetails, {
  countFilled,
  useMoreDetails,
} from 'components/MoreDetails'
import NewClientDialog from 'components/NewClientDialog'
import NumberField from 'components/NumberField'
import SelectField from 'components/SelectField'
import TextField from 'components/TextField'
import type { Currency } from 'schemas/account'
import {
  expenseToRow,
  isRefuelExpense,
  tripExpenseChanges,
  type Expense,
} from 'schemas/expenses'
import { knownPlaces, knownSpelling } from 'schemas/rates'
import {
  EMPTY_TRIP_FORM,
  TRIP_LIMITS,
  TRIP_STATUS_LABELS,
  TRIP_STATUSES,
  tripFormSchema,
  tripFromForm,
  tripIncome,
  isTooLate,
  toCents,
  tripToForm,
  type Trip,
  type TripFormValues,
} from 'schemas/trips'
import { newExpenseId } from 'services/expenses'
import { saveTripWithExpenses } from 'services/trips'
import { useExpensesStore } from 'store/expenses'
import { useFleetStore } from 'store/fleet'
import { recoverFromLostPermission, useSessionStore } from 'store/session'
import { useTripsStore } from 'store/trips'
import { fromDateTimeValue, toDateTimeValue } from 'utils/dateTimeValue'
import { currencySymbol, moneyTotal } from 'utils/formatMoney'
import { formatEditable } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'
import { reportError } from 'utils/reportError'

interface TripFormProps {
  /** The trip being edited, or null for a new one. */
  trip: Trip | null
  /** Its expenses, as read: rows of "Gastos (opcional)" (specs/0026). */
  expenses: readonly Expense[]
  /** The id the new trip will have (made when the form opened). */
  id: string
  orgId: string
  currency: Currency
}

const FORM_ID = 'trip-form'
const PLACES_ID = 'trip-places'

// Behind "Ver más detalles" (specs/0025 RF-9)
const DETAILS = ['tripNumber', 'description', 'notes'] as const

const MODE_OPTIONS = [
  { value: 'rate', label: 'Desde una tarifa' },
  { value: 'manual', label: 'Manual' },
]

const STATUS_OPTIONS = TRIP_STATUSES.map(status => ({
  value: status,
  label: TRIP_STATUS_LABELS[status],
}))

/** A trip's form, to create or edit it (backend specs/0025 RF-9, RF-10). */
export default function TripForm({
  trip,
  expenses: allTripExpenses,
  id,
  orgId,
  currency,
}: TripFormProps) {
  const [, navigate] = useLocation()
  // A refuel's expense follows its refuel (specs/0027 RF-10): shown, not a row
  const refuelExpenses = allTripExpenses.filter(isRefuelExpense)
  const tripExpenses = allTripExpenses.filter(
    expense => !isRefuelExpense(expense)
  )
  const refuelsTotal = refuelExpenses
    .filter(expense => expense.currency === (trip?.currency ?? currency))
    .reduce((sum, expense) => sum + expense.amount, 0)
  const { clients, trucks, trailers, drivers, rates } = useFleetStore()
  const tripsSeen = useTripsStore(state => state.known)
  const saveTrip = useTripsStore(state => state.save)
  const categories = useExpensesStore(state => state.categories)
  const applyTripExpenses = useExpensesStore(state => state.applyTripExpenses)
  const uid = useSessionStore(state => state.user?.uid ?? '')
  const [now] = useState(() => new Date())
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: trip
      ? { ...tripToForm(trip), expenses: tripExpenses.map(expenseToRow) }
      : EMPTY_TRIP_FORM(now),
  })
  const extras = useFieldArray({ control, name: 'extras' })
  const expenseRows = useFieldArray({
    control,
    name: 'expenses',
    keyName: 'key',
  })
  const values = useWatch({ control })
  const details = useMoreDetails<TripFormValues>(DETAILS, setFocus)
  const [secondDriver, setSecondDriver] = useState(
    Boolean(trip?.secondDriverId)
  )
  const [newClient, setNewClient] = useState(false)
  // "Sin remolque" chosen is a choice too: the truck does not replace it
  // (audit 0027); an edited trip already has its own
  const [trailerChosen, setTrailerChosen] = useState(trip !== null)
  // Said when a rate moves the trip to its client (RF-9)
  const [clientNotice, setClientNotice] = useState<string | null>(null)

  // Archived items are not offered, unless this trip already has them
  const active = <T extends { id: string; archived: boolean }>(
    items: readonly T[],
    keep: (string | null | undefined)[]
  ) => items.filter(item => !item.archived || keep.includes(item.id))

  const clientName = (clientId: string | null) =>
    clientId ? (clients.find(item => item.id === clientId)?.name ?? null) : null

  // The rates in the organization's currency: the trip's client's first,
  // then the general ones, then the rest
  const rateRank = (clientId: string | null) =>
    clientId !== null && clientId === values.clientId
      ? 0
      : clientId === null
        ? 1
        : 2
  const usableRates = active(rates, [trip?.rateId])
    // In the trip's currency: an old trip keeps its own (audit 0027)
    .filter(
      rate =>
        rate.currency === (trip?.currency ?? currency) ||
        rate.id === trip?.rateId
    )
    .sort((a, b) => rateRank(a.clientId) - rateRank(b.clientId))
  const currentRate = rates.find(rate => rate.id === values.rateId) ?? null
  // Kept rate: the trip shows and saves the copy it has, even if the rate
  // changed since (0025 RF-1; audit 0027)
  const chosenRate =
    trip?.mode === 'rate' && trip.rateId === values.rateId
      ? {
          origin: trip.origin,
          destination: trip.destination,
          price: trip.price,
          currency: trip.currency,
        }
      : currentRate
  const places = knownPlaces([...rates, ...Object.values(tripsSeen)])

  const price =
    values.mode === 'rate'
      ? (chosenRate?.price ?? 0)
      : parseDecimal(values.price ?? '')
  const income = tripIncome({
    price: Number.isNaN(price) ? 0 : price,
    extras: (values.extras ?? []).map(extra => {
      const amount = parseDecimal(extra.amount ?? '')
      return {
        description: '',
        amount: Number.isNaN(amount) ? 0 : amount,
      }
    }),
  })

  const expensesTotal = toCents(
    (values.expenses ?? []).reduce((sum, row) => {
      const amount = parseDecimal(row.amount ?? '')
      return sum + (Number.isNaN(amount) ? 0 : amount)
    }, refuelsTotal)
  )

  // A new row's date is the trip's start, or now if it starts later (RF-12)
  const addExpenseRow = () => {
    const start = fromDateTimeValue(getValues('startAt'))
    expenseRows.append({
      id: newExpenseId(),
      categoryId: '',
      amount: '',
      takenAt: toDateTimeValue(start && !isTooLate(start) ? start : new Date()),
      description: '',
    })
  }

  const chooseRate = (rateId: string) => {
    const rate = rates.find(item => item.id === rateId)
    setClientNotice(null)
    if (!rate?.clientId || rate.clientId === getValues('clientId')) return
    const had = getValues('clientId')
    setValue('clientId', rate.clientId, { shouldValidate: true })
    const name = clientName(rate.clientId) ?? rate.clientName
    if (had && name) {
      setClientNotice(`Cambiamos el cliente a ${name}, el de la tarifa`)
    }
  }

  const chooseMode = (mode: string) => {
    // From a rate to manual, the chosen rate's values stay to be edited
    // (RF-9): always its own, not those of an earlier one (audit 0027)
    if (mode !== 'manual' || !chosenRate) return
    setValue('origin', chosenRate.origin)
    setValue('destination', chosenRate.destination)
    setValue('price', formatEditable(chosenRate.price))
  }

  // The truck brings its hitched trailer and the driver linked to its
  // assigned member, only where nothing was chosen yet (RF-9)
  const chooseTruck = (truckId: string) => {
    const truck = trucks.find(item => item.id === truckId)
    if (!truck) return
    if (!trailerChosen && !getValues('trailerId')) {
      const trailer = trailers.find(
        item => !item.archived && item.hitchedTruckId === truck.id
      )
      if (trailer) setValue('trailerId', trailer.id)
    }
    if (!getValues('driverId') && truck.assignedDriverUid) {
      const driver = drivers.find(
        item => !item.archived && item.memberUid === truck.assignedDriverUid
      )
      if (driver) setValue('driverId', driver.id, { shouldValidate: true })
    }
  }

  const onSubmit = (values: TripFormValues) => {
    const fields = tripFromForm(
      {
        ...values,
        // A place typed another way is saved as already written (0024)
        origin: knownSpelling(values.origin, places),
        destination: knownSpelling(values.destination, places),
      },
      { currency, clients, trucks, trailers, drivers, rates },
      trip
    )
    const saved: Trip = {
      id,
      orgId,
      ...fields,
      // The backend keeps it (RF-3); meanwhile, what the rows add up to
      expensesTotal: toCents(
        values.expenses.reduce(
          (sum, row) => sum + parseDecimal(row.amount),
          refuelsTotal
        )
      ),
      createdAt: trip?.createdAt ?? null,
      createdBy: trip?.createdBy ?? uid,
    }
    const expenses = tripExpenseChanges(
      values.expenses,
      saved,
      tripExpenses,
      // New rows in the trip's currency, which its total adds up (RF-3)
      {
        currency: trip?.currency ?? currency,
        categories,
        trucks,
        trailers,
        drivers,
      },
      uid
    )
    applyTripExpenses(expenses.saved, expenses.remove)
    saveTrip(saved, () =>
      saveTripWithExpenses(id, orgId, fields, trip === null, expenses)
    ).catch((error: unknown) => {
      reportError(error, { operation: 'saveTrip' })
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: 'No pudimos guardar el viaje',
        description: 'Revisa los datos y vuelve a intentarlo.',
      })
    })
    sileo.success({
      title: 'Viaje guardado',
      ...(!navigator.onLine && {
        description: 'Se subirá cuando tengas señal.',
      }),
    })
    navigate(`/viajes/${id}`)
  }

  const option = (item: { id: string; name: string }) => ({
    value: item.id,
    label: item.name,
  })
  const clientOptions = active(clients, [trip?.clientId]).map(option)
  const truckOptions = active(trucks, [trip?.truckId]).map(option)
  const trailerOptions = [
    { value: '', label: 'Sin remolque' },
    ...active(trailers, [trip?.trailerId]).map(option),
  ]
  const driverOptions = active(drivers, [
    trip?.driverId,
    trip?.secondDriverId,
  ]).map(option)
  const rateOptions = usableRates.map(rate => {
    const owner = rate.clientId
      ? (clientName(rate.clientId) ?? rate.clientName)
      : 'General'
    return {
      value: rate.id,
      label:
        rate.clientId && rate.clientId !== values.clientId
          ? `${rate.label} · ${owner ?? ''}`
          : rate.label,
      keywords: owner ?? '',
    }
  })

  return (
    <Box
      component="form"
      id={FORM_ID}
      noValidate
      aria-label="Datos del viaje"
      onSubmit={event => {
        void handleSubmit(onSubmit, details.onInvalid)(event)
      }}
    >
      <Stack spacing={5}>
        {/* 1. The client, or a new one (RF-10) */}
        <Box>
          <AutocompleteField
            id="tripClient"
            label="Cliente"
            options={clientOptions}
            placeholder="Elige el cliente"
            error={errors.clientId?.message}
            {...(clientNotice !== null && { hint: clientNotice })}
            control={control}
            name="clientId"
            onChange={() => {
              setClientNotice(null)
            }}
          />
          <Button
            startIcon={<PersonAddOutlinedIcon />}
            onClick={() => {
              setNewClient(true)
            }}
            sx={{ mt: 1, ml: -2 }}
          >
            Nuevo cliente
          </Button>
        </Box>

        {/* 2. From a rate or by hand */}
        <ChoiceButtons
          id="tripMode"
          label="¿Cómo se calcula el precio?"
          options={MODE_OPTIONS}
          control={control}
          name="mode"
          onChange={chooseMode}
        />
        {values.mode === 'rate' ? (
          <Box>
            <AutocompleteField
              id="tripRate"
              label="Tarifa"
              options={rateOptions}
              placeholder="Busca origen, destino o cliente"
              error={errors.rateId?.message}
              control={control}
              name="rateId"
              onChange={chooseRate}
            />
            {chosenRate && (
              <Typography
                variant="body2"
                sx={{ mt: 1, color: 'text.secondary' }}
              >
                {chosenRate.origin} → {chosenRate.destination} ·{' '}
                {moneyTotal(chosenRate.currency, chosenRate.price)}
              </Typography>
            )}
          </Box>
        ) : (
          <>
            {/* Origin and destination on one row, as in a rate (0024) */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 2,
              }}
            >
              <TextField
                id="tripOrigin"
                dense
                label="Origen"
                placeholder="Managua"
                maxLength={TRIP_LIMITS.place}
                list={PLACES_ID}
                error={errors.origin?.message}
                registration={register('origin')}
              />
              <TextField
                id="tripDestination"
                dense
                label="Destino"
                placeholder="San José"
                maxLength={TRIP_LIMITS.place}
                list={PLACES_ID}
                error={errors.destination?.message}
                registration={register('destination')}
              />
            </Box>
            <datalist id={PLACES_ID}>
              {places.map(place => (
                <option key={place} value={place} />
              ))}
            </datalist>
            <NumberField
              id="tripPrice"
              label="Precio"
              prefix={currencySymbol(currency)}
              placeholder="25,000"
              error={errors.price?.message}
              registration={register('price')}
            />
          </>
        )}

        {/* 3. Extras the client asks for: stops and the like */}
        <Box role="group" aria-labelledby="trip-extras-title">
          <Typography
            id="trip-extras-title"
            variant="overline"
            component="p"
            sx={{ color: 'text.secondary' }}
          >
            Ingresos adicionales (opcional)
          </Typography>
          <Stack spacing={3}>
            {extras.fields.map((field, index) => (
              <Box
                key={field.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr) auto',
                  gap: 2,
                  alignItems: 'start',
                }}
              >
                <TextField
                  id={`tripExtra${String(index)}Description`}
                  dense
                  label="Descripción"
                  placeholder="Parada en León"
                  maxLength={TRIP_LIMITS.extraDescription}
                  error={errors.extras?.[index]?.description?.message}
                  registration={register(
                    `extras.${String(index)}.description` as `extras.${number}.description`
                  )}
                />
                <NumberField
                  id={`tripExtra${String(index)}Amount`}
                  dense
                  label="Monto"
                  prefix={currencySymbol(currency)}
                  placeholder="2,500"
                  error={errors.extras?.[index]?.amount?.message}
                  registration={register(
                    `extras.${String(index)}.amount` as `extras.${number}.amount`
                  )}
                />
                <IconButton
                  aria-label={`Quitar el ingreso ${String(index + 1)}`}
                  onClick={() => {
                    extras.remove(index)
                  }}
                  sx={{ mt: 7 }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            ))}
          </Stack>
          {extras.fields.length < TRIP_LIMITS.extras && (
            <Button
              startIcon={<AddIcon />}
              onClick={() => {
                extras.append({ description: '', amount: '' })
              }}
              sx={{ mt: 1, ml: -2 }}
            >
              Agregar ingreso
            </Button>
          )}
          <Typography variant="subtitle2" component="p" sx={{ mt: 2 }}>
            Ingresos: {moneyTotal(currency, income)}
          </Typography>
        </Box>

        {/* 4–6. Truck, trailer and drivers */}
        <AutocompleteField
          id="tripTruck"
          label="Camión"
          options={truckOptions}
          placeholder="Elige el camión"
          error={errors.truckId?.message}
          control={control}
          name="truckId"
          onChange={chooseTruck}
        />
        <AutocompleteField
          id="tripTrailer"
          label="Remolque (opcional)"
          options={trailerOptions}
          control={control}
          name="trailerId"
          onChange={() => {
            setTrailerChosen(true)
          }}
        />
        <AutocompleteField
          id="tripDriver"
          label="Conductor"
          options={driverOptions}
          placeholder="Elige el conductor"
          error={errors.driverId?.message}
          control={control}
          name="driverId"
        />
        {secondDriver ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 2,
              alignItems: 'start',
            }}
          >
            <AutocompleteField
              id="tripSecondDriver"
              label="Segundo conductor"
              options={driverOptions.filter(
                driver => driver.value !== values.driverId
              )}
              placeholder="Elige el conductor"
              error={errors.secondDriverId?.message}
              control={control}
              name="secondDriverId"
            />
            <IconButton
              aria-label="Quitar el segundo conductor"
              onClick={() => {
                setValue('secondDriverId', '')
                setSecondDriver(false)
              }}
              sx={{ mt: 7 }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        ) : (
          <Button
            startIcon={<AddIcon />}
            onClick={() => {
              setSecondDriver(true)
            }}
            sx={{ alignSelf: 'flex-start', ml: -2, mt: -3 }}
          >
            Agregar segundo conductor
          </Button>
        )}

        {/* 7–8. When, and how it goes */}
        <DateTimeField
          id="tripStartAt"
          label="Inicio"
          control={control}
          name="startAt"
          error={errors.startAt?.message}
        />
        <DateTimeField
          id="tripEndAt"
          label="Fin (opcional)"
          hint="Para marcarlo Terminado."
          control={control}
          name="endAt"
          error={errors.endAt?.message}
          clearable
        />
        <SelectField
          id="tripStatus"
          label="Estado"
          options={STATUS_OPTIONS}
          control={control}
          name="status"
        />

        {/* 9. Its expenses, saved with it (specs/0026 RF-12) */}
        <Box role="group" aria-labelledby="trip-expenses-title">
          <Typography
            id="trip-expenses-title"
            variant="overline"
            component="p"
            sx={{ color: 'text.secondary' }}
          >
            Gastos (opcional)
          </Typography>
          {refuelExpenses.length > 0 && (
            <Box
              component="ul"
              aria-label="Gastos de rellenos"
              sx={{ listStyle: 'none', m: 0, mb: 3, p: 0 }}
            >
              {refuelExpenses.map(expense => (
                <Box
                  component="li"
                  key={expense.id}
                  sx={{
                    py: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 2,
                    }}
                  >
                    <Typography variant="body2">
                      {categories.find(item => item.id === expense.categoryId)
                        ?.name ?? expense.categoryName}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                      {moneyTotal(expense.currency, expense.amount)}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    component="p"
                    sx={{ color: 'text.secondary' }}
                  >
                    {expense.description
                      ? `De un relleno: ${expense.description}. Se cambia en el relleno.`
                      : 'De un relleno. Se cambia en el relleno.'}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          <Stack spacing={3}>
            {expenseRows.fields.map((field, index) => {
              const row = `expenses.${String(index)}` as `expenses.${number}`
              const rowErrors = errors.expenses?.[index]
              const categoryOptions = categories
                .filter(
                  category =>
                    !category.archived ||
                    category.id ===
                      tripExpenses.find(e => e.id === field.id)?.categoryId
                )
                .map(option)
              return (
                <Box
                  key={field.key}
                  role="group"
                  aria-label={`Gasto ${String(index + 1)}`}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
                    gap: 2,
                    alignItems: 'start',
                    pb: 3,
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ gridColumn: '1 / 3' }}>
                    <AutocompleteField
                      id={`tripExpense${String(index)}Category`}
                      label="Categoría"
                      options={categoryOptions}
                      placeholder="Elige la categoría"
                      error={rowErrors?.categoryId?.message}
                      control={control}
                      name={`${row}.categoryId`}
                    />
                  </Box>
                  <IconButton
                    aria-label={`Quitar el gasto ${String(index + 1)}`}
                    onClick={() => {
                      expenseRows.remove(index)
                    }}
                    sx={{ mt: 7 }}
                  >
                    <CloseIcon />
                  </IconButton>
                  <Box sx={{ gridColumn: '1 / 3' }}>
                    <NumberField
                      id={`tripExpense${String(index)}Amount`}
                      dense
                      label="Monto"
                      prefix={currencySymbol(currency)}
                      placeholder="1,850"
                      error={rowErrors?.amount?.message}
                      registration={register(`${row}.amount`)}
                    />
                  </Box>
                  <Box sx={{ gridColumn: '1 / 4' }}>
                    <TextField
                      id={`tripExpense${String(index)}Description`}
                      dense
                      label="Descripción (opcional)"
                      placeholder="Peaje de Tipitapa"
                      maxLength={TRIP_LIMITS.expenseDescription}
                      error={rowErrors?.description?.message}
                      registration={register(`${row}.description`)}
                    />
                  </Box>
                  <Box sx={{ gridColumn: '1 / 4' }}>
                    <DateTimeField
                      id={`tripExpense${String(index)}TakenAt`}
                      label="Fecha y hora"
                      control={control}
                      name={`${row}.takenAt`}
                      error={rowErrors?.takenAt?.message}
                    />
                  </Box>
                </Box>
              )
            })}
          </Stack>
          {expenseRows.fields.length < TRIP_LIMITS.expenses && (
            <Button
              startIcon={<AddIcon />}
              onClick={addExpenseRow}
              sx={{ mt: 1, ml: -2 }}
            >
              Agregar gasto
            </Button>
          )}
          <Typography variant="subtitle2" component="p" sx={{ mt: 2 }}>
            Gastos: {moneyTotal(trip?.currency ?? currency, expensesTotal)}
          </Typography>
          {expenseRows.fields.length > 0 && (
            <Typography
              variant="caption"
              component="p"
              sx={{ color: 'text.secondary' }}
            >
              La foto del comprobante se agrega desde cada gasto.
            </Typography>
          )}
        </Box>

        {/* 10. The rest */}
        <MoreDetails
          open={details.open}
          onToggle={details.toggle}
          filled={countFilled([
            values.tripNumber,
            values.description,
            values.notes,
          ])}
        >
          <TextField
            id="tripNumber"
            label="Número de viaje (opcional)"
            placeholder="F-1024"
            maxLength={TRIP_LIMITS.tripNumber}
            error={errors.tripNumber?.message}
            registration={register('tripNumber')}
          />
          <TextField
            id="tripDescription"
            label="Descripción (opcional)"
            placeholder="Contenedor de 40 pies"
            maxLength={TRIP_LIMITS.description}
            error={errors.description?.message}
            registration={register('description')}
          />
          <TextField
            id="tripNotes"
            label="Notas (opcional)"
            placeholder="Observaciones del viaje"
            maxLength={TRIP_LIMITS.notes}
            error={errors.notes?.message}
            registration={register('notes')}
          />
        </MoreDetails>

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          loading={isSubmitting}
          loadingPosition="start"
        >
          {trip ? 'Guardar cambios' : 'Guardar viaje'}
        </Button>
      </Stack>

      {newClient && (
        <NewClientDialog
          orgId={orgId}
          onCreated={clientId => {
            setValue('clientId', clientId, { shouldValidate: true })
          }}
          onClose={() => {
            setNewClient(false)
          }}
        />
      )}
    </Box>
  )
}
