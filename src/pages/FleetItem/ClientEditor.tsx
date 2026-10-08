import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import ClientFields, { CLIENT_DETAILS } from 'components/ClientFields'
import { useMoreDetails } from 'components/MoreDetails'
import {
  clientFormSchema,
  clientFromForm,
  clientToForm,
  clientWithName,
  duplicateNameMessage,
  type Client,
  type ClientFormValues,
} from 'schemas/clients'
import { useFleetStore } from 'store/fleet'
import type { FleetSection } from 'utils/fleetSections'
import EditorLayout from './EditorLayout'
import { useSaveFleetItem } from './useSaveFleetItem'

interface Props {
  section: FleetSection
  client: Client | null
  id: string
  orgId: string
  canWrite: boolean
}

const FORM_ID = 'client-form'

/** A client of the organization (backend specs/0022 RF-6, RF-7). */
export default function ClientEditor({
  section,
  client,
  id,
  orgId,
  canWrite,
}: Props) {
  const clients = useFleetStore(state => state.clients)
  const saveItem = useSaveFleetItem(section)
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: clientToForm(client),
    disabled: !canWrite,
  })
  const values = useWatch({ control })
  const details = useMoreDetails<ClientFormValues>(CLIENT_DETAILS, setFocus)

  const onSubmit = (values: ClientFormValues) => {
    // The rules cannot check that a name is unique: the app does (RNF-4)
    const other = clientWithName(values.name, clients, id)
    if (other) {
      setError(
        'name',
        { message: duplicateNameMessage(other) },
        {
          shouldFocus: true,
        }
      )
      return
    }
    const fields = clientFromForm(values)
    saveItem(
      { id, orgId, archived: client?.archived ?? false, ...fields },
      fields,
      client === null
    )
  }

  return (
    <EditorLayout
      section={section}
      item={client}
      id={id}
      canWrite={canWrite}
      formId={FORM_ID}
      saving={isSubmitting}
    >
      <Box
        component="form"
        id={FORM_ID}
        noValidate
        aria-label="Datos del cliente"
        onSubmit={event => {
          void handleSubmit(onSubmit, details.onInvalid)(event)
        }}
      >
        <ClientFields
          register={register}
          errors={errors}
          values={values}
          details={details}
        />
      </Box>
    </EditorLayout>
  )
}
