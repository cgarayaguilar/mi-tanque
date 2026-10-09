import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import DriverFields, { DRIVER_DETAILS } from 'components/DriverFields'
import { useMoreDetails } from 'components/MoreDetails'
import { useCreateFleetItem } from 'hooks/useCreateFleetItem'
import {
  driverFormSchema,
  driverFromForm,
  driverLinkedTo,
  driverToForm,
  driverWithName,
  duplicateDriverMessage,
  type DriverFormValues,
} from 'schemas/drivers'
import { newFleetId } from 'services/fleet'
import { useFleetStore } from 'store/fleet'
import { sectionBySlug } from 'utils/fleetSections'
import { ROLE_LABELS } from 'utils/roles'
import CreateDialog from './CreateDialog'
import type { CreateDialogProps } from './types'

const SECTION = sectionBySlug('conductores')

/** "+ Crear conductor" (specs/0028), with the checks of 0023 RF-8. */
export default function DriverDialog({
  orgId,
  initialName = '',
  onCreated,
  onClose,
}: CreateDialogProps) {
  const drivers = useFleetStore(state => state.drivers)
  const members = useFleetStore(state => state.members)
  const saveItem = useCreateFleetItem(SECTION)
  const [id] = useState(newFleetId)
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    setError,
    formState: { errors },
  } = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: { ...driverToForm(null), name: initialName },
  })
  const values = useWatch({ control })
  const details = useMoreDetails<DriverFormValues>(DRIVER_DETAILS, setFocus)

  const memberName = (uid: string) =>
    members.find(member => member.uid === uid)?.displayName ?? 'ese miembro'

  const onSubmit = (values: DriverFormValues) => {
    const other = driverWithName(values.name, drivers, id)
    if (other) {
      setError(
        'name',
        { message: duplicateDriverMessage(other) },
        { shouldFocus: true }
      )
      return
    }
    const linked = values.memberUid
      ? driverLinkedTo(values.memberUid, drivers, id)
      : null
    if (linked) {
      setError('memberUid', {
        message: `${memberName(values.memberUid)} ya está enlazada a ${linked.name}`,
      })
      if (!details.open) details.toggle()
      return
    }
    const fields = driverFromForm(values)
    saveItem({ id, orgId, archived: false, ...fields }, fields, true)
    onCreated(id)
    onClose()
  }

  const memberOptions = [
    { value: '', label: 'Sin cuenta' },
    ...members.map(member => ({
      value: member.uid,
      label: `${member.displayName} (${ROLE_LABELS[member.role]})`,
    })),
  ]

  return (
    <CreateDialog
      title="Nuevo conductor"
      formId="create-driver"
      saveLabel="Guardar conductor"
      onSubmit={event => {
        void handleSubmit(onSubmit, details.onInvalid)(event)
      }}
      onClose={onClose}
    >
      <DriverFields
        register={register}
        control={control}
        errors={errors}
        values={values}
        details={details}
        memberOptions={memberOptions}
        disabled={false}
      />
    </CreateDialog>
  )
}
