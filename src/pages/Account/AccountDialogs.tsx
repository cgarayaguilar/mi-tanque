import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation } from 'wouter'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddBusinessIcon from '@mui/icons-material/AddBusiness'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import AutocompleteField from 'components/AutocompleteField'
import TextField from 'components/TextField'
import { useLoad } from 'hooks/useLoad'
import {
  CURRENCY_OPTIONS,
  organizationFormSchema,
  type OrganizationFormValues,
} from 'schemas/account'
import {
  DELETE_CONFIRMATION,
  deleteAccountFormSchema,
  type DeleteAccountFormValues,
} from 'schemas/team'
import { readOwnershipBlocks } from 'services/team'
import { useSessionStore } from 'store/session'
import { reportError } from 'utils/reportError'
import {
  teamErrorDetails,
  teamErrorMessage,
  teamErrorReason,
} from 'utils/teamErrors'

function CreateOrganizationDialog({ onClose }: { onClose: () => void }) {
  const createOrganization = useSessionStore(state => state.createOrganization)
  const currency = useSessionStore(
    state => state.organization?.defaultCurrency ?? 'USD'
  )
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: { name: '', defaultCurrency: currency },
  })

  const create = async ({ name, defaultCurrency }: OrganizationFormValues) => {
    try {
      await createOrganization({ name, currency: defaultCurrency })
      sileo.success({
        title: `Creaste ${name}`,
        description: 'Es tu organización activa.',
      })
      onClose()
    } catch (error) {
      reportError(error, { operation: 'createOrganization' })
      sileo.error({
        title: 'No pudimos crear la organización',
        description:
          teamErrorReason(error) === 'limit'
            ? 'Puedes estar en 10 organizaciones como máximo.'
            : teamErrorMessage(error),
      })
    }
  }

  return (
    <Dialog
      open
      onClose={isSubmitting ? undefined : onClose}
      aria-labelledby="new-org-title"
      fullWidth
    >
      <DialogTitle id="new-org-title">Nueva organización</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          id="new-org"
          noValidate
          onSubmit={event => {
            void handleSubmit(create)(event)
          }}
          sx={{ pt: 2 }}
        >
          <Stack spacing={4}>
            <TextField
              id="newOrgName"
              label="Nombre"
              placeholder="Transportes Pérez"
              autoComplete="organization"
              error={errors.name?.message}
              registration={register('name')}
            />
            <AutocompleteField
              id="newOrgCurrency"
              label="Moneda"
              options={CURRENCY_OPTIONS}
              error={errors.defaultCurrency?.message}
              control={control}
              name="defaultCurrency"
            />
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="new-org"
          variant="contained"
          loading={isSubmitting}
        >
          Crear
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Mi cuenta → crear otra organización (backend specs/0005 RF-13). */
export function CreateOrganizationButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outlined"
        fullWidth
        startIcon={<AddBusinessIcon />}
        onClick={() => {
          setOpen(true)
        }}
        sx={{ mt: 4 }}
      >
        Crear organización
      </Button>
      {open && (
        <CreateOrganizationDialog
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const memberships = useSessionStore(state => state.memberships)
  const deleteAccount = useSessionStore(state => state.deleteAccount)
  const [, navigate] = useLocation()
  const [serverBlocks, setServerBlocks] = useState<string[] | null>(null)
  const blocks = useLoad('blocks', () => readOwnershipBlocks(memberships))
  const blockedOrgs = serverBlocks ?? blocks.value ?? []
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountFormValues>({
    resolver: zodResolver(deleteAccountFormSchema),
    defaultValues: { confirmation: '' },
  })

  const confirm = async () => {
    try {
      await deleteAccount()
      sileo.success({
        title: 'Eliminamos tu cuenta',
        description: 'Los datos de este teléfono sin cuenta siguen aquí.',
      })
      navigate('/', { replace: true })
    } catch (error) {
      if (teamErrorReason(error) === 'must-transfer') {
        const { orgNames } = teamErrorDetails(error)
        setServerBlocks(Array.isArray(orgNames) ? orgNames.map(String) : [])
        return
      }
      reportError(error, { operation: 'deleteAccount' })
      sileo.error({
        title: 'No pudimos eliminar tu cuenta',
        description: teamErrorMessage(error),
      })
    }
  }

  const checking = blocks.value === undefined && blocks.error === undefined
  return (
    <Dialog
      open
      onClose={isSubmitting ? undefined : onClose}
      aria-labelledby="delete-title"
      fullWidth
    >
      <DialogTitle id="delete-title">¿Eliminar tu cuenta?</DialogTitle>
      <DialogContent>
        {checking ? (
          <Stack
            spacing={1}
            aria-busy="true"
            aria-label="Revisando tus organizaciones"
          >
            <Skeleton variant="text" />
            <Skeleton variant="text" width="80%" />
          </Stack>
        ) : blockedOrgs.length > 0 ? (
          <DialogContentText role="alert">
            Eres el único Dueño de {blockedOrgs.join(', ')}, donde hay más
            personas. Nombra a otro Dueño en Equipo y vuelve a intentarlo.
          </DialogContentText>
        ) : (
          <Box
            component="form"
            id="delete-account"
            noValidate
            onSubmit={event => {
              void handleSubmit(confirm)(event)
            }}
          >
            <Box
              component="ul"
              sx={{ m: 0, mb: 4, pl: 5, '& li + li': { mt: 1 } }}
            >
              <Typography component="li" variant="body2">
                Se borran tu cuenta y las organizaciones donde estás solo, con
                su flota, sus mediciones y sus fotos.
              </Typography>
              <Typography component="li" variant="body2">
                En las organizaciones compartidas, tus mediciones se quedan con
                tu nombre.
              </Typography>
              <Typography component="li" variant="body2">
                No se puede deshacer. Los datos de este teléfono sin cuenta no
                se tocan.
              </Typography>
            </Box>
            <TextField
              id="deleteConfirmation"
              label={`Escribe ${DELETE_CONFIRMATION} para confirmar`}
              autoComplete="off"
              error={errors.confirmation?.message}
              registration={register('confirmation')}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        {!checking && blockedOrgs.length === 0 && (
          <Button
            type="submit"
            form="delete-account"
            variant="contained"
            color="error"
            loading={isSubmitting}
          >
            Eliminar mi cuenta
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

/** Mi cuenta → eliminar la cuenta (backend specs/0005 RF-14). */
export function DeleteAccountButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        color="error"
        fullWidth
        startIcon={<DeleteForeverIcon />}
        onClick={() => {
          setOpen(true)
        }}
        sx={{ mt: 2 }}
      >
        Eliminar mi cuenta
      </Button>
      {open && (
        <DeleteAccountDialog
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
