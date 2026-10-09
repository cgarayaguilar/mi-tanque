import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMoreDetails } from 'components/MoreDetails'
import TruckFields, { TRUCK_DETAILS } from 'components/TruckFields'
import { useCreateFleetItem } from 'hooks/useCreateFleetItem'
import { useFormDistanceUnit } from 'hooks/useDistanceUnit'
import {
  truckFormSchema,
  truckFromForm,
  truckToForm,
  type TruckFormValues,
} from 'schemas/fleet'
import { newFleetId } from 'services/fleet'
import { useFleetStore } from 'store/fleet'
import { sectionBySlug } from 'utils/fleetSections'
import CreateDialog from './CreateDialog'
import type { CreateDialogProps } from './types'

const SECTION = sectionBySlug('camiones')

/** "+ Crear camión" (specs/0028): its photo is added later, in Flota. */
export default function TruckDialog({
  orgId,
  initialName = '',
  onCreated,
  onClose,
}: CreateDialogProps) {
  const members = useFleetStore(state => state.members)
  const saveItem = useCreateFleetItem(SECTION)
  const unit = useFormDistanceUnit()
  const [id] = useState(newFleetId)
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    setValue,
    formState: { errors },
  } = useForm<TruckFormValues>({
    resolver: zodResolver(truckFormSchema),
    defaultValues: { ...truckToForm(null, unit), name: initialName },
  })
  const values = useWatch({ control })
  const details = useMoreDetails<TruckFormValues>(TRUCK_DETAILS, setFocus)

  const onSubmit = (values: TruckFormValues) => {
    const fields = truckFromForm(values, unit)
    saveItem(
      { id, orgId, archived: false, photoPath: null, ...fields },
      fields,
      true
    )
    onCreated(id)
    onClose()
  }

  return (
    <CreateDialog
      title="Nuevo camión"
      formId="create-truck"
      saveLabel="Guardar camión"
      onSubmit={event => {
        void handleSubmit(onSubmit, details.onInvalid)(event)
      }}
      onClose={onClose}
    >
      <TruckFields
        register={register}
        control={control}
        setValue={setValue}
        errors={errors}
        values={values}
        details={details}
        unit={unit}
        members={members}
        idPrefix="create-truck-"
      />
    </CreateDialog>
  )
}
