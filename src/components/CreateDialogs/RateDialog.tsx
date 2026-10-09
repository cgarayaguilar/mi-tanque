import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import RateFields from 'components/RateFields'
import { useCreateFleetItem } from 'hooks/useCreateFleetItem'
import {
  duplicateRateMessage,
  knownPlaces,
  knownSpelling,
  rateFormSchema,
  rateFromForm,
  rateToForm,
  routeName,
  sameRate,
  type RateFormValues,
} from 'schemas/rates'
import { newFleetId } from 'services/fleet'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import { sectionBySlug } from 'utils/fleetSections'
import CreateDialog from './CreateDialog'
import type { CreateDialogProps } from './types'

const SECTION = sectionBySlug('tarifas')

/**
 * "+ Crear tarifa" (specs/0028): empty, by the owner's choice; in the
 * organization's currency (0024 RF-1), with its repeated-rate check.
 */
export default function RateDialog({
  orgId,
  onCreated,
  onClose,
}: CreateDialogProps) {
  const rates = useFleetStore(state => state.rates)
  const clients = useFleetStore(state => state.clients)
  const currency = useSessionStore(
    state => state.organization?.defaultCurrency ?? 'USD'
  )
  const saveItem = useCreateFleetItem(SECTION)
  const [id] = useState(newFleetId)
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<RateFormValues>({
    resolver: zodResolver(rateFormSchema),
    defaultValues: rateToForm(null),
  })
  const values = useWatch({ control })
  const places = knownPlaces(rates)

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
        archived: false,
        name: routeName(fields.origin, fields.destination),
        ...fields,
      },
      fields,
      true
    )
    onCreated(id)
    onClose()
  }

  const clientOptions = [
    { value: '', label: 'General (sin cliente)' },
    ...clients
      .filter(client => !client.archived)
      .map(client => ({ value: client.id, label: client.name })),
  ]

  return (
    <CreateDialog
      title="Nueva tarifa"
      formId="create-rate"
      saveLabel="Guardar tarifa"
      onSubmit={event => {
        void handleSubmit(onSubmit)(event)
      }}
      onClose={onClose}
    >
      <RateFields
        register={register}
        control={control}
        errors={errors}
        values={values}
        currency={currency}
        places={places}
        clientOptions={clientOptions}
        disabled={false}
      />
    </CreateDialog>
  )
}
