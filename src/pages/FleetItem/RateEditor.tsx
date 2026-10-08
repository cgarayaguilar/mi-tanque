import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import RateFields from 'components/RateFields'
import {
  duplicateRateMessage,
  knownPlaces,
  knownSpelling,
  rateFormSchema,
  rateFromForm,
  rateToForm,
  routeName,
  sameRate,
  type Rate,
  type RateFormValues,
} from 'schemas/rates'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import type { FleetSection } from 'utils/fleetSections'
import EditorLayout from './EditorLayout'
import { useSaveFleetItem } from './useSaveFleetItem'

interface Props {
  section: FleetSection
  rate: Rate | null
  id: string
  orgId: string
  canWrite: boolean
}

const FORM_ID = 'rate-form'

/** A rate of the organization (backend specs/0024 RF-6, RF-8). */
export default function RateEditor({
  section,
  rate,
  id,
  orgId,
  canWrite,
}: Props) {
  const rates = useFleetStore(state => state.rates)
  const clients = useFleetStore(state => state.clients)
  const defaultCurrency = useSessionStore(
    state => state.organization?.defaultCurrency ?? 'USD'
  )
  // A rate keeps the currency it was made in (RF-2)
  const currency = rate?.currency ?? defaultCurrency
  const saveItem = useSaveFleetItem(section)
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RateFormValues>({
    resolver: zodResolver(rateFormSchema),
    defaultValues: rateToForm(rate),
    disabled: !canWrite,
  })
  const values = useWatch({ control })

  // Without this rate's own places: editing it can change their spelling
  const places = knownPlaces(rates.filter(item => item.id !== id))

  const onSubmit = (values: RateFormValues) => {
    const fields = rateFromForm(
      {
        ...values,
        origin: knownSpelling(values.origin, places),
        destination: knownSpelling(values.destination, places),
      },
      currency,
      clients
    )
    // The rules cannot check that a rate is unique: the app does (RF-8)
    const other = sameRate(fields, rates, id)
    if (other) {
      setError(
        'origin',
        { message: duplicateRateMessage(other) },
        { shouldFocus: true }
      )
      return
    }
    saveItem(
      {
        id,
        orgId,
        archived: rate?.archived ?? false,
        name: routeName(fields.origin, fields.destination),
        ...fields,
      },
      fields,
      rate === null
    )
  }

  // Active clients, and this rate's even if archived since
  const clientOptions = [
    { value: '', label: 'General (sin cliente)' },
    ...clients
      .filter(client => !client.archived || client.id === rate?.clientId)
      .map(client => ({ value: client.id, label: client.name })),
  ]

  return (
    <EditorLayout
      section={section}
      item={rate}
      id={id}
      canWrite={canWrite}
      formId={FORM_ID}
      saving={isSubmitting}
    >
      <Box
        component="form"
        id={FORM_ID}
        noValidate
        aria-label="Datos de la tarifa"
        onSubmit={event => {
          void handleSubmit(onSubmit)(event)
        }}
      >
        <RateFields
          register={register}
          control={control}
          errors={errors}
          values={values}
          currency={currency}
          places={places}
          clientOptions={clientOptions}
          disabled={!canWrite}
        />
      </Box>
    </EditorLayout>
  )
}
