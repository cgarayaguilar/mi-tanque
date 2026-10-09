import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import ClientFields, { CLIENT_DETAILS } from 'components/ClientFields'
import { useMoreDetails } from 'components/MoreDetails'
import { useCreateFleetItem } from 'hooks/useCreateFleetItem'
import {
  clientFormSchema,
  clientFromForm,
  clientToForm,
  clientWithName,
  duplicateNameMessage,
  type ClientFormValues,
} from 'schemas/clients'
// Only lazy pages open these dialogs: the SDK stays out of the basic mode
import { newFleetId } from 'services/fleet'
import { useFleetStore } from 'store/fleet'
import { sectionBySlug } from 'utils/fleetSections'
import CreateDialog from './CreateDialog'
import type { CreateDialogProps } from './types'

const SECTION = sectionBySlug('clientes')

/** "+ Crear cliente" (specs/0028; before, "Nuevo cliente" of 0025). */
export default function ClientDialog({
  orgId,
  initialName = '',
  onCreated,
  onClose,
}: CreateDialogProps) {
  const clients = useFleetStore(state => state.clients)
  const saveItem = useCreateFleetItem(SECTION)
  // Its id exists from the moment the dialog opens (ADR 0003)
  const [id] = useState(newFleetId)
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    setError,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: { ...clientToForm(null), name: initialName },
  })
  const values = useWatch({ control })
  const details = useMoreDetails<ClientFormValues>(CLIENT_DETAILS, setFocus)

  const onSubmit = (values: ClientFormValues) => {
    const other = clientWithName(values.name, clients, id)
    if (other) {
      setError(
        'name',
        { message: duplicateNameMessage(other) },
        { shouldFocus: true }
      )
      return
    }
    const fields = clientFromForm(values)
    saveItem({ id, orgId, archived: false, ...fields }, fields, true)
    onCreated(id)
    onClose()
  }

  return (
    <CreateDialog
      title="Nuevo cliente"
      formId="create-client"
      saveLabel="Guardar cliente"
      onSubmit={event => {
        void handleSubmit(onSubmit, details.onInvalid)(event)
      }}
      onClose={onClose}
    >
      <ClientFields
        register={register}
        errors={errors}
        values={values}
        details={details}
      />
    </CreateDialog>
  )
}
