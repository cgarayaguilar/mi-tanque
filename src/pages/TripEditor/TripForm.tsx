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
import { knownPlaces, knownSpelling } from 'schemas/rates'
import {
  EMPTY_TRIP_FORM,
  TRIP_LIMITS,
  TRIP_STATUS_LABELS,
  TRIP_STATUSES,
  tripFormSchema,
  tripFromForm,
  tripIncome,
  tripToForm,
  type Trip,
  type TripFormValues,
} from 'schemas/trips'
import { createTrip, updateTrip } from 'services/trips'
import { useFleetStore } from 'store/fleet'
import { recoverFromLostPermission, useSessionStore } from 'store/session'
import { useTripsStore } from 'store/trips'
import { currencySymbol, moneyTotal } from 'utils/formatMoney'
import { parseDecimal } from 'utils/parseDecimal'
import { reportError } from 'utils/reportError'

interface TripFormProps {
  /** The trip being edited, or null for a new one. */
  trip: Trip | null
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
export default function TripForm({ trip, id, orgId, currency }: TripFormProps) {
  const [, navigate] = useLocation()
  const { clients, trucks, trailers, drivers, rates } = useFleetStore()
  const tripsSeen = useTripsStore(state => state.known)
  const saveTrip = useTripsStore(state => state.save)
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
    defaultValues: trip ? tripToForm(trip) : EMPTY_TRIP_FORM(now),
  })
  const extras = useFieldArray({ control, name: 'extras' })
  const values = useWatch({ control })
  const details = useMoreDetails<TripFormValues>(DETAILS, setFocus)
  const [secondDriver, setSecondDriver] = useState(
    Boolean(trip?.secondDriverId)
  )
  const [newClient, setNewClient] = useState(false)
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
    .filter(rate => rate.currency === currency || rate.id === trip?.rateId)
    .sort((a, b) => rateRank(a.clientId) - rateRank(b.clientId))
  const chosenRate = rates.find(rate => rate.id === values.rateId) ?? null
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
    // From a rate to manual, its values stay to be edited (RF-9)
    if (mode !== 'manual' || !chosenRate) return
    if (!getValues('origin')) setValue('origin', chosenRate.origin)
    if (!getValues('destination'))
      setValue('destination', chosenRate.destination)
    if (!getValues('price')) setValue('price', String(chosenRate.price))
  }

  // The truck brings its hitched trailer and the driver linked to its
  // assigned member, only where nothing was chosen yet (RF-9)
  const chooseTruck = (truckId: string) => {
    const truck = trucks.find(item => item.id === truckId)
    if (!truck) return
    if (!getValues('trailerId')) {
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
      createdAt: trip?.createdAt ?? null,
      createdBy: trip?.createdBy ?? uid,
    }
    saveTrip(saved, () =>
      trip ? updateTrip(id, fields) : createTrip(id, orgId, fields)
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

        {/* 9. The rest */}
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
