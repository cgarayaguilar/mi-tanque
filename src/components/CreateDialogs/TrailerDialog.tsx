import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMoreDetails } from 'components/MoreDetails'
import TrailerFields, { TRAILER_DETAILS } from 'components/TrailerFields'
import { useCreateFleetItem } from 'hooks/useCreateFleetItem'
import {
  trailerFormSchema,
  trailerFromForm,
  trailerToForm,
  type TrailerFormValues,
} from 'schemas/fleet'
import { newFleetId } from 'services/fleet'
import { useFleetStore } from 'store/fleet'
import { sectionBySlug } from 'utils/fleetSections'
import CreateDialog from './CreateDialog'
import type { CreateDialogProps } from './types'

const SECTION = sectionBySlug('remolques')

/** "+ Crear remolque" (specs/0028): its photo is added later, in Flota. */
export default function TrailerDialog({
  orgId,
  initialName = '',
  onCreated,
  onClose,
}: CreateDialogProps) {
  const trucks = useFleetStore(state => state.trucks)
  const saveItem = useCreateFleetItem(SECTION)
  const [id] = useState(newFleetId)
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    formState: { errors },
  } = useForm<TrailerFormValues>({
    resolver: zodResolver(trailerFormSchema),
    defaultValues: { ...trailerToForm(null), name: initialName },
  })
  const values = useWatch({ control })
  const details = useMoreDetails<TrailerFormValues>(TRAILER_DETAILS, setFocus)

  const onSubmit = (values: TrailerFormValues) => {
    const fields = trailerFromForm(values)
    saveItem(
      { id, orgId, archived: false, photoPath: null, ...fields },
      fields,
      true
    )
    onCreated(id)
    onClose()
  }

  const truckOptions = [
    { value: '', label: 'Sin enganchar' },
    ...trucks
      .filter(truck => !truck.archived)
      .map(truck => ({ value: truck.id, label: truck.name })),
  ]

  return (
    <CreateDialog
      title="Nuevo remolque"
      formId="create-trailer"
      saveLabel="Guardar remolque"
      onSubmit={event => {
        void handleSubmit(onSubmit, details.onInvalid)(event)
      }}
      onClose={onClose}
    >
      <TrailerFields
        register={register}
        control={control}
        errors={errors}
        values={values}
        details={details}
        truckOptions={truckOptions}
        idPrefix="create-trailer-"
      />
    </CreateDialog>
  )
}
