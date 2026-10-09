import { useEffect, useState } from 'react'
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
} from 'react-hook-form'
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
import AutocompleteField from 'components/AutocompleteField'
import ChoiceButtons from 'components/ChoiceButtons'
import DateTimeField from 'components/DateTimeField'
import FormSection from 'components/FormSection'
import MoreDetails, {
  countFilled,
  useMoreDetails,
} from 'components/MoreDetails'
import { useCreateDialogs } from 'components/CreateDialogs'
import NumberField from 'components/NumberField'
import SelectField from 'components/SelectField'
import TextField from 'components/TextField'
import type { Currency } from 'schemas/account'
import {
  expenseRowWrites,
  expenseToRow,
  isRefuelExpense,
  tripExpenseChanges,
  type Expense,
} from 'schemas/expenses'
import { knownPlaces, knownSpelling, ratesByClient } from 'schemas/rates'
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
  type ExpenseRowValues,
  type ExtraValues,
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
import ExpenseCard from './ExpenseCard'
import ExpenseRowDialog from './ExpenseRowDialog'
import ExtraDialog from './ExtraDialog'
import IncomeCard, { PriceCard } from './IncomeCard'
import TripSummaryBar from './TripSummaryBar'

interface TripFormProps {
  /** The trip being edited, or null for a new one. */
  trip: Trip | null
  /** Its expenses, as read: the cards of "Gastos" (specs/0026, 0029). */
  expenses: readonly Expense[]
  /** The id the new trip will have (made when the form opened). */
  id: string
  orgId: string
  currency: Currency
  /** A new trip's first values: the truck of a refuel (specs/0031 RF-3). */
  preset?: Partial<Pick<TripFormValues, 'truckId' | 'trailerId'>>
  /** In a dialog: saved, it tells who opened it instead of going to it. */
  onSaved?: (trip: Trip) => void
  /** In a dialog: whether something was written, to ask before closing. */
  onDirtyChange?: (dirty: boolean) => void
}

const FORM_ID = 'trip-form'
const PLACES_ID = 'trip-places'

// Behind "Ver más detalles" (specs/0025 RF-9)
const DETAILS = ['tripNumber', 'description', 'notes'] as const

// The form's sections and their fields, in order (specs/0029 RF-1, RF-2)
const SECTIONS = [
  {
    id: 'trip-section-price',
    fields: ['clientId', 'rateId', 'origin', 'destination', 'price'],
  },
  {
    id: 'trip-section-truck',
    fields: ['truckId', 'trailerId', 'driverId', 'secondDriverId'],
  },
  { id: 'trip-section-dates', fields: ['startAt', 'endAt', 'status'] },
  { id: 'trip-section-income', fields: ['extras'] },
  { id: 'trip-section-expenses', fields: ['expenses'] },
] as const satisfies readonly {
  id: string
  fields: readonly (keyof TripFormValues)[]
}[]

const MODE_OPTIONS = [
  { value: 'rate', label: 'Desde una tarifa' },
  { value: 'manual', label: 'Manual' },
]

const STATUS_OPTIONS = TRIP_STATUSES.map(status => ({
  value: status,
  label: TRIP_STATUS_LABELS[status],
}))

/** A field's errors: one per field, one per income or expense with any. */
const issuesIn = (error: unknown) =>
  Array.isArray(error) ? error.filter(Boolean).length : error ? 1 : 0

/**
 * What choosing a truck brings: its hitched trailer and the driver linked
 * to its assigned member (specs/0025 RF-9). Read from the store as it is
 * now, so a truck just created counts (specs/0028).
 */
const truckBrings = (truckId: string) => {
  const fleet = useFleetStore.getState()
  const truck = fleet.trucks.find(item => item.id === truckId)
  if (!truck) return { trailerId: undefined, driverId: undefined }
  const trailer = fleet.trailers.find(
    item => !item.archived && item.hitchedTruckId === truck.id
  )
  const driver = truck.assignedDriverUid
    ? fleet.drivers.find(
        item => !item.archived && item.memberUid === truck.assignedDriverUid
      )
    : undefined
  return { trailerId: trailer?.id, driverId: driver?.id }
}

/** A new trip's values; a preset truck brings its own (audit 2026-10-09). */
const newTripValues = (now: Date, preset: TripFormProps['preset']) => {
  const brings = preset?.truckId ? truckBrings(preset.truckId) : null
  return {
    ...EMPTY_TRIP_FORM(now),
    ...(brings?.trailerId && { trailerId: brings.trailerId }),
    ...(brings?.driverId && { driverId: brings.driverId }),
    ...preset,
  }
}

/** A trip's form, to create or edit it (backend specs/0025 RF-9, 0029). */
export default function TripForm({
  trip,
  expenses: allTripExpenses,
  id,
  orgId,
  currency: organizationCurrency,
  preset,
  onSaved,
  onDirtyChange,
}: TripFormProps) {
  const [, navigate] = useLocation()
  // An old trip keeps its own currency (0025): everything here is in it
  const currency = trip?.currency ?? organizationCurrency
  // A refuel's expense follows its refuel (specs/0027 RF-10): shown, not a row
  const refuelExpenses = allTripExpenses.filter(isRefuelExpense)
  const tripExpenses = allTripExpenses.filter(
    expense => !isRefuelExpense(expense)
  )
  const refuelsTotal = refuelExpenses
    .filter(expense => expense.currency === currency)
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
    formState: { errors, isSubmitting, isDirty },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: trip
      ? { ...tripToForm(trip), expenses: tripExpenses.map(expenseToRow) }
      : newTripValues(now, preset),
  })
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])
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
  // "+ Crear …" in each list (backend specs/0028)
  const { create, dialog } = useCreateDialogs(orgId)
  // "Sin remolque" chosen is a choice too: the truck does not replace it
  // (audit 0027); an edited trip already has its own
  const [trailerChosen, setTrailerChosen] = useState(
    trip !== null || Boolean(preset?.trailerId)
  )
  // Said when a rate moves the trip to its client (RF-9)
  const [clientNotice, setClientNotice] = useState<string | null>(null)
  // The income or expense open in its dialog; index null is a new one (0029)
  const [extraOpen, setExtraOpen] = useState<{ index: number | null } | null>(
    null
  )
  const [expenseOpen, setExpenseOpen] = useState<{
    index: number | null
    row: ExpenseRowValues
  } | null>(null)

  // Archived items are not offered, unless this trip already has them
  const active = <T extends { id: string; archived: boolean }>(
    items: readonly T[],
    keep: (string | null | undefined)[]
  ) => items.filter(item => !item.archived || keep.includes(item.id))

  const clientName = (clientId: string | null) =>
    clientId ? (clients.find(item => item.id === clientId)?.name ?? null) : null

  // The rates in the trip's currency: an old trip keeps its own (audit 0027)
  const usableRates = active(rates, [trip?.rateId]).filter(
    rate => rate.currency === currency || rate.id === trip?.rateId
  )
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

  const typedPrice = parseDecimal(values.price ?? '')
  // null until there is one: the price card says how to give it (0029 RF-3)
  const price =
    values.mode === 'rate'
      ? (chosenRate?.price ?? null)
      : Number.isNaN(typedPrice)
        ? null
        : typedPrice
  const route =
    values.mode === 'rate'
      ? chosenRate && `${chosenRate.origin} → ${chosenRate.destination}`
      : [values.origin?.trim(), values.destination?.trim()].every(Boolean)
        ? `${values.origin?.trim() ?? ''} → ${values.destination?.trim() ?? ''}`
        : null
  // The income and the expenses have no field in the form, only their
  // dialogs: their rows are what the field arrays hold (specs/0029)
  const income = tripIncome({
    price: price ?? 0,
    extras: extras.fields.map(extra => {
      const amount = parseDecimal(extra.amount)
      return {
        description: '',
        amount: Number.isNaN(amount) ? 0 : amount,
      }
    }),
  })

  // A saved row keeps its own currency; only the trip's adds up (audit
  // 2026-10-09: an expense in another currency was summed as the trip's)
  const rowCurrency = (rowId: string) =>
    tripExpenses.find(expense => expense.id === rowId)?.currency ?? currency
  const rowsTotal = (rows: readonly ExpenseRowValues[]) =>
    toCents(
      rows
        .filter(row => rowCurrency(row.id) === currency)
        .reduce((sum, row) => {
          const amount = parseDecimal(row.amount)
          return sum + (Number.isNaN(amount) ? 0 : amount)
        }, refuelsTotal)
    )
  const expensesTotal = rowsTotal(expenseRows.fields)

  // A new expense's date is the trip's start, or now if it starts later
  // (0026 RF-12)
  const newExpenseRow = (): ExpenseRowValues => {
    const start = fromDateTimeValue(getValues('startAt'))
    return {
      id: newExpenseId(),
      categoryId: '',
      amount: '',
      takenAt: toDateTimeValue(start && !isTooLate(start) ? start : new Date()),
      description: '',
      driverId: '',
    }
  }

  // The store as it is now, not this render's lists: a rate or a truck just
  // created from the list is already there (specs/0028)
  const chooseRate = (rateId: string) => {
    const rate = useFleetStore.getState().rates.find(item => item.id === rateId)
    setClientNotice(null)
    if (!rate?.clientId || rate.clientId === getValues('clientId')) return
    const had = getValues('clientId')
    setValue('clientId', rate.clientId, { shouldValidate: true })
    const name = clientName(rate.clientId) ?? rate.clientName
    if (had && name) {
      setClientNotice(`Cambiamos el cliente a ${name}, el de la tarifa`)
    }
  }

  // A rate just created: chosen if it can price this trip, in its currency
  const chooseCreatedRate = (rateId: string) => {
    const rate = useFleetStore.getState().rates.find(item => item.id === rateId)
    if (rate && rate.currency !== currency) {
      sileo.warning({
        title: 'Guardamos la tarifa, pero este viaje no puede usarla',
        description: `La tarifa está en ${rate.currency} y este viaje en ${currency}.`,
      })
      return
    }
    setValue('rateId', rateId, { shouldValidate: true })
    chooseRate(rateId)
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
    const { trailerId, driverId } = truckBrings(truckId)
    if (trailerId && !trailerChosen && !getValues('trailerId'))
      setValue('trailerId', trailerId)
    if (driverId && !getValues('driverId'))
      setValue('driverId', driverId, { shouldValidate: true })
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
      expensesTotal: rowsTotal(values.expenses),
      createdAt: trip?.createdAt ?? null,
      createdBy: trip?.createdBy ?? uid,
    }
    const expenses = tripExpenseChanges(
      values.expenses,
      saved,
      tripExpenses,
      // New rows in the trip's currency, which its total adds up (RF-3)
      { currency, categories, trucks, trailers, drivers },
      uid
    )
    // One batch carries only so many rows (audit 2026-10-09: an old trip's
    // rows were all editable, past the limit)
    if (
      expenses.create.length + expenses.update.length >
      TRIP_LIMITS.expenses
    ) {
      sileo.error({
        title: 'Son muchos gastos para guardar a la vez',
        description: `Guarda hasta ${String(TRIP_LIMITS.expenses)} gastos nuevos o cambiados; los demás, después.`,
      })
      return
    }
    applyTripExpenses(expenses.saved, expenses.remove)
    saveTrip(saved, () =>
      saveTripWithExpenses(id, orgId, fields, trip === null, expenses)
    ).catch((error: unknown) => {
      // Refused, nothing of the batch was written: its rows go back as they
      // were (audit 2026-10-09)
      applyTripExpenses(
        tripExpenses.filter(
          expense =>
            expenses.remove.includes(expense.id) ||
            expenses.saved.some(item => item.id === expense.id)
        ),
        expenses.create.map(item => item.id)
      )
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
    if (onSaved) onSaved(saved)
    else navigate(`/viajes/${id}`)
  }

  // A failed save goes to the first section with something to fix (0029
  // RF-2). A field there takes the focus itself; an income or an expense
  // has no field in the form, so its section is brought into view.
  const onInvalid = (failed: FieldErrors<TripFormValues>) => {
    details.onInvalid(failed)
    const first = SECTIONS.find(section =>
      section.fields.some(field => field in failed)
    )
    if (first?.fields.some(field => field === 'extras' || field === 'expenses'))
      document
        .getElementById(first.id)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const sectionIssues = (index: number) =>
    (SECTIONS[index]?.fields ?? []).reduce<number>(
      (sum, field) => sum + issuesIn(errors[field]),
      0
    )

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
  // Under their client: the trip's client's first, then the general ones,
  // then the rest (0025 RF-9; specs/0033 RF-3)
  const rateOptions = ratesByClient(
    usableRates,
    clientName,
    values.clientId || null
  ).map(({ rate, group }) => ({ value: rate.id, label: rate.label, group }))

  const categoryName = (categoryId: string, expenseId: string) =>
    categories.find(item => item.id === categoryId)?.name ??
    allTripExpenses.find(expense => expense.id === expenseId)?.categoryName ??
    'Gasto'
  const driverName = (driverId: string, expenseId: string) =>
    drivers.find(item => item.id === driverId)?.name ??
    allTripExpenses.find(expense => expense.id === expenseId)?.driverName ??
    null

  const extraFields = extras.fields.map(({ id: key, ...extra }, index) => ({
    key,
    index,
    extra,
  }))
  const rowFields = expenseRows.fields.map(({ key, ...row }, index) => ({
    key,
    index,
    row,
  }))
  const openRow = expenseOpen?.row ?? null
  const openRowOld = openRow
    ? tripExpenses.find(expense => expense.id === openRow.id)
    : undefined

  const addButton = (label: string, onClick: () => void) => (
    <Button startIcon={<AddIcon />} onClick={onClick} aria-label={label}>
      Agregar
    </Button>
  )

  return (
    <Box
      component="form"
      id={FORM_ID}
      noValidate
      aria-label="Datos del viaje"
      onSubmit={event => {
        void handleSubmit(onSubmit, onInvalid)(event)
      }}
    >
      <Stack spacing={4}>
        {/* 1. For whom, and for how much */}
        <FormSection
          number={1}
          id={SECTIONS[0].id}
          title="Cliente y precio"
          hint="¿Para quién es y cuánto cobras?"
          issues={sectionIssues(0)}
        >
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
            create={{
              label: 'Crear cliente',
              onCreate: text => {
                create('client', text, id => {
                  setClientNotice(null)
                  setValue('clientId', id, { shouldValidate: true })
                })
              },
            }}
          />
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
                create={{
                  label: 'Crear tarifa',
                  // Empty, by the owner's choice (specs/0028)
                  withText: false,
                  onCreate: () => {
                    create('rate', '', chooseCreatedRate)
                  },
                }}
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
        </FormSection>

        {/* 2. Truck, trailer and drivers */}
        <FormSection
          number={2}
          id={SECTIONS[1].id}
          title="Camión y conductores"
          hint="¿Con qué y con quién?"
          issues={sectionIssues(1)}
        >
          <AutocompleteField
            id="tripTruck"
            label="Camión"
            options={truckOptions}
            placeholder="Elige el camión"
            error={errors.truckId?.message}
            control={control}
            name="truckId"
            onChange={chooseTruck}
            create={{
              label: 'Crear camión',
              onCreate: text => {
                create('truck', text, id => {
                  setValue('truckId', id, { shouldValidate: true })
                  chooseTruck(id)
                })
              },
            }}
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
            create={{
              label: 'Crear remolque',
              onCreate: text => {
                create('trailer', text, id => {
                  setTrailerChosen(true)
                  setValue('trailerId', id)
                })
              },
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
            create={{
              label: 'Crear conductor',
              onCreate: text => {
                create('driver', text, id => {
                  setValue('driverId', id, { shouldValidate: true })
                })
              },
            }}
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
                create={{
                  label: 'Crear conductor',
                  onCreate: text => {
                    create('driver', text, id => {
                      setValue('secondDriverId', id, { shouldValidate: true })
                    })
                  },
                }}
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
        </FormSection>

        {/* 3. When, and how it goes */}
        <FormSection
          number={3}
          id={SECTIONS[2].id}
          title="Fechas y estado"
          hint="¿Cuándo?"
          issues={sectionIssues(2)}
        >
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
        </FormSection>

        {/* 4. The price and the extras the client pays: stops and the like */}
        <FormSection
          number={4}
          id={SECTIONS[3].id}
          title="Ingresos"
          hint="El precio y lo que se cobra aparte."
          issues={sectionIssues(3)}
          {...(extras.fields.length < TRIP_LIMITS.extras && {
            action: addButton('Agregar ingreso', () => {
              setExtraOpen({ index: null })
            }),
          })}
        >
          <Stack
            component="ul"
            aria-label="Ingresos del viaje"
            spacing={2}
            sx={{ listStyle: 'none', m: 0, p: 0 }}
          >
            <PriceCard price={price} route={route} currency={currency} />
            {extraFields.map(({ key, index, extra }) => (
              <IncomeCard
                key={key}
                extra={extra}
                currency={currency}
                issue={errors.extras?.[index] ? 'Revisa este ingreso' : null}
                onEdit={() => {
                  setExtraOpen({ index })
                }}
                onRemove={() => {
                  extras.remove(index)
                }}
              />
            ))}
          </Stack>
          <Typography variant="subtitle2" component="p">
            Ingresos: {moneyTotal(currency, income)}
          </Typography>
        </FormSection>

        {/* 5. Its expenses, saved with it (specs/0026 RF-12) */}
        <FormSection
          number={5}
          id={SECTIONS[4].id}
          title="Gastos"
          hint="Lo que costó el viaje."
          issues={sectionIssues(4)}
          // New or changed rows, the ones a save writes (audit 2026-10-09)
          {...(expenseRowWrites(
            rowFields.map(({ row }) => row),
            tripExpenses
          ) < TRIP_LIMITS.expenses && {
            action: addButton('Agregar gasto', () => {
              setExpenseOpen({ index: null, row: newExpenseRow() })
            }),
          })}
        >
          {refuelExpenses.length + rowFields.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Aún no hay gastos en este viaje.
            </Typography>
          ) : (
            <Stack
              component="ul"
              aria-label="Gastos del viaje"
              spacing={2}
              sx={{ listStyle: 'none', m: 0, p: 0 }}
            >
              {refuelExpenses.map(expense => (
                <ExpenseCard
                  key={expense.id}
                  refuel
                  category={categoryName(expense.categoryId, expense.id)}
                  amount={expense.amount}
                  currency={expense.currency}
                  takenAt={expense.takenAt}
                  description={expense.description}
                  driverName={expense.driverName}
                  hasReceipt={Boolean(expense.receiptPhotoPath)}
                />
              ))}
              {rowFields.map(({ key, index, row }) => {
                const old = tripExpenses.find(expense => expense.id === row.id)
                const amount = parseDecimal(row.amount)
                return (
                  <ExpenseCard
                    key={key}
                    category={categoryName(row.categoryId, row.id)}
                    amount={Number.isNaN(amount) ? 0 : amount}
                    currency={old?.currency ?? currency}
                    takenAt={fromDateTimeValue(row.takenAt)}
                    description={row.description.trim() || null}
                    driverName={
                      row.driverId ? driverName(row.driverId, row.id) : null
                    }
                    hasReceipt={Boolean(old?.receiptPhotoPath)}
                    isNew={!old}
                    issue={
                      errors.expenses?.[index] ? 'Revisa este gasto' : null
                    }
                    onEdit={() => {
                      setExpenseOpen({ index, row })
                    }}
                    onRemove={() => {
                      expenseRows.remove(index)
                    }}
                  />
                )
              })}
            </Stack>
          )}
          <Box>
            <Typography variant="subtitle2" component="p">
              Gastos: {moneyTotal(currency, expensesTotal)}
            </Typography>
            {rowFields.length > 0 && (
              <Typography
                variant="caption"
                component="p"
                sx={{ color: 'text.secondary' }}
              >
                La foto del comprobante se agrega desde cada gasto, después de
                guardar el viaje.
              </Typography>
            )}
          </Box>
        </FormSection>

        {/* The rest */}
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

        <TripSummaryBar
          income={income}
          expenses={expensesTotal}
          currency={currency}
          formId={FORM_ID}
          saveLabel={trip ? 'Guardar cambios' : 'Guardar viaje'}
          saving={isSubmitting}
        />
      </Stack>

      {extraOpen && (
        <ExtraDialog
          extra={
            extraOpen.index === null
              ? null
              : (extraFields[extraOpen.index]?.extra ?? null)
          }
          currency={currency}
          onSave={(extra: ExtraValues) => {
            if (extraOpen.index === null) extras.append(extra)
            else extras.update(extraOpen.index, extra)
          }}
          onClose={() => {
            setExtraOpen(null)
          }}
        />
      )}
      {expenseOpen && openRow && (
        <ExpenseRowDialog
          row={openRow}
          isNew={expenseOpen.index === null}
          currency={openRowOld?.currency ?? currency}
          categoryOptions={categories
            .filter(
              category =>
                !category.archived || category.id === openRowOld?.categoryId
            )
            .map(option)}
          driverOptions={active(drivers, [openRowOld?.driverId]).map(option)}
          create={create}
          onSave={row => {
            if (expenseOpen.index === null) expenseRows.append(row)
            else expenseRows.update(expenseOpen.index, row)
          }}
          onClose={() => {
            setExpenseOpen(null)
          }}
        />
      )}
      {dialog}
    </Box>
  )
}
