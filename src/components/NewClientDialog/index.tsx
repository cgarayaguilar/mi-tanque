import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import ClientFields, { CLIENT_DETAILS } from 'components/ClientFields'
import { useMoreDetails } from 'components/MoreDetails'
import {
  clientFormSchema,
  clientFromForm,
  clientToForm,
  clientWithName,
  duplicateNameMessage,
  type ClientFormValues,
} from 'schemas/clients'
// Only lazy pages open this dialog: the SDK stays out of the basic mode
import { createFleetItem, newFleetId } from 'services/fleet'
import { useFleetStore } from 'store/fleet'
import { recoverFromLostPermission } from 'store/session'
import { reportError } from 'utils/reportError'

interface NewClientDialogProps {
  orgId: string
  onCreated: (clientId: string) => void
  onClose: () => void
}

/**
 * "Nuevo cliente" from a trip (backend specs/0025 RF-10): the client's own
 * fields and name check (specs/0022), saved the offline way, then chosen.
 */
export default function NewClientDialog({
  orgId,
  onCreated,
  onClose,
}: NewClientDialogProps) {
  const clients = useFleetStore(state => state.clients)
  const save = useFleetStore(state => state.save)
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
    defaultValues: clientToForm(null),
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
    save('clients', { id, orgId, archived: false, ...fields }, () =>
      createFleetItem('clients', id, orgId, fields)
    ).catch((error: unknown) => {
      reportError(error, { operation: 'saveClientFromTrip' })
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: `No pudimos guardar el cliente ${fields.name}`,
        description: 'Revisa los datos y vuelve a intentarlo.',
      })
    })
    sileo.success({
      title: 'Cliente guardado',
      ...(!navigator.onLine && {
        description: 'Se subirá cuando tengas señal.',
      }),
    })
    onCreated(id)
    onClose()
  }

  return (
    <Dialog open onClose={onClose} aria-labelledby="new-client-title" fullWidth>
      <DialogTitle id="new-client-title">Nuevo cliente</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          id="new-client"
          noValidate
          onSubmit={event => {
            // Its own form, inside the trip's: the trip is not submitted
            event.stopPropagation()
            void handleSubmit(onSubmit, details.onInvalid)(event)
          }}
          sx={{ pt: 2 }}
        >
          <ClientFields
            register={register}
            errors={errors}
            values={values}
            details={details}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="new-client" variant="contained">
          Guardar cliente
        </Button>
      </DialogActions>
    </Dialog>
  )
}
