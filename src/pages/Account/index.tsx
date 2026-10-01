import { useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sileo } from 'sileo'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { useImportLocalData } from 'hooks/useImportLocalData'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import NativeSelect from '@mui/material/NativeSelect'
import OutlinedInput from '@mui/material/OutlinedInput'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import LogoutIcon from '@mui/icons-material/Logout'
import SelectField from 'components/SelectField'
import SessionGate from 'components/SessionGate'
import Stat from 'components/Stat'
import TextField from 'components/TextField'
import { useSignOut } from 'hooks/useSignOut'
import {
  CURRENCY_NAMES,
  CURRENCY_OPTIONS,
  organizationFormSchema,
  profileFormSchema,
  type OrganizationFormValues,
  type ProfileFormValues,
} from 'schemas/account'
import { warmUpAccount } from 'services/session'
import { selectActiveRole, useSessionStore } from 'store/session'
import { radius } from 'theme/tokens'
import { authErrorMessage } from 'utils/authErrors'
import { reportError } from 'utils/reportError'
import { canEditOrganization, canWriteFleet, ROLE_LABELS } from 'utils/roles'

const failed = (operation: string, title: string) => (error: unknown) => {
  reportError(error, { operation })
  sileo.error({ title, description: authErrorMessage(error) })
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={{
        p: 4,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.xl)}px`,
      }}
    >
      <Typography id={id} variant="subtitle1" component="h2" sx={{ mb: 4 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

function ProfileSection() {
  const user = useSessionStore(state => state.user)
  const displayName = useSessionStore(state => state.profile?.displayName ?? '')
  const updateProfile = useSessionStore(state => state.updateProfile)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { displayName },
  })

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      await updateProfile(values.displayName)
      reset(values)
      sileo.success({ title: 'Guardamos tu nombre' })
    } catch (error) {
      failed('updateProfile', 'No pudimos guardar tu nombre')(error)
    }
  }

  return (
    <Section id="profile-title" title="Tu perfil">
      <Box
        component="form"
        noValidate
        aria-label="Tu perfil"
        onSubmit={event => {
          void handleSubmit(onSubmit)(event)
        }}
      >
        <TextField
          id="profileName"
          label="Tu nombre"
          autoComplete="name"
          hint={user?.phoneNumber ?? user?.email ?? 'Así te verá tu equipo.'}
          error={errors.displayName?.message}
          registration={register('displayName')}
        />
        <Button
          type="submit"
          variant="outlined"
          loading={isSubmitting}
          disabled={!isDirty}
          sx={{ mt: 3 }}
        >
          Guardar nombre
        </Button>
      </Box>
    </Section>
  )
}

function OrganizationSwitcher() {
  const memberships = useSessionStore(state => state.memberships)
  const activeOrgId = useSessionStore(state => state.organization?.id ?? '')
  const switchOrganization = useSessionStore(state => state.switchOrganization)

  if (memberships.length < 2) return null

  return (
    <FormControl fullWidth sx={{ mb: 4 }}>
      <FormLabel htmlFor="activeOrg">Organización activa</FormLabel>
      <NativeSelect
        input={<OutlinedInput />}
        value={activeOrgId}
        inputProps={{ id: 'activeOrg' }}
        onChange={event => {
          switchOrganization(event.target.value).then(
            () => {
              sileo.success({ title: 'Cambiaste de organización' })
            },
            failed('switchOrganization', 'No pudimos cambiar de organización')
          )
        }}
      >
        {memberships.map(membership => (
          <option key={membership.orgId} value={membership.orgId}>
            {membership.orgName}
          </option>
        ))}
      </NativeSelect>
    </FormControl>
  )
}

function OrganizationForm() {
  const organization = useSessionStore(state => state.organization)
  const updateOrganization = useSessionStore(state => state.updateOrganization)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: organization?.name ?? '',
      defaultCurrency: organization?.defaultCurrency ?? 'USD',
    },
  })

  const onSubmit = async (values: OrganizationFormValues) => {
    try {
      await updateOrganization({
        ...(dirtyFields.name && { name: values.name }),
        ...(dirtyFields.defaultCurrency && {
          defaultCurrency: values.defaultCurrency,
        }),
      })
      reset(values)
      sileo.success({ title: 'Guardamos los cambios de la organización' })
    } catch (error) {
      failed('updateOrganization', 'No pudimos guardar la organización')(error)
    }
  }

  return (
    <Box
      component="form"
      noValidate
      aria-label="Datos de la organización"
      onSubmit={event => {
        void handleSubmit(onSubmit)(event)
      }}
    >
      <Stack spacing={4}>
        <TextField
          id="orgName"
          label="Nombre de la organización"
          autoComplete="organization"
          error={errors.name?.message}
          registration={register('name')}
        />
        <SelectField
          id="defaultCurrency"
          label="Moneda"
          options={CURRENCY_OPTIONS}
          hint="Para el costo de los rellenos de combustible."
          error={errors.defaultCurrency?.message}
          registration={register('defaultCurrency')}
        />
      </Stack>
      <Button
        type="submit"
        variant="outlined"
        loading={isSubmitting}
        disabled={!isDirty}
        sx={{ mt: 3 }}
      >
        Guardar cambios
      </Button>
    </Box>
  )
}

function OrganizationSection() {
  const organization = useSessionStore(state => state.organization)
  const role = useSessionStore(selectActiveRole)

  return (
    <Section id="organization-title" title="Organización">
      <OrganizationSwitcher />
      {role && (
        <Chip
          label={`Tu rol: ${ROLE_LABELS[role]}`}
          size="small"
          sx={{ mb: 4 }}
        />
      )}
      {organization && canEditOrganization(role) ? (
        // A new key after switching: the form starts from that org's values
        <OrganizationForm key={organization.id} />
      ) : (
        organization && (
          <Stack direction="row" spacing={6}>
            <Stat size="small" label="Nombre" value={organization.name} />
            <Stat
              size="small"
              label="Moneda"
              value={organization.defaultCurrency}
              caption={CURRENCY_NAMES[organization.defaultCurrency]}
            />
          </Stack>
        )
      )}
    </Section>
  )
}

function ImportSection() {
  const role = useSessionStore(selectActiveRole)
  const { importing, run } = useImportLocalData()
  if (!canWriteFleet(role)) return null

  return (
    <Section id="import-title" title="Datos de este teléfono">
      <Typography variant="body2" sx={{ mb: 4 }}>
        Pasa a tu organización los tanques y las mediciones que guardaste sin
        cuenta. Repetirlo no duplica nada y aquí no se borran.
      </Typography>
      <Button
        variant="outlined"
        fullWidth
        startIcon={<CloudUploadIcon />}
        loading={importing}
        loadingPosition="start"
        onClick={() => void run()}
      >
        Importar datos de este teléfono
      </Button>
    </Section>
  )
}

function AccountScreen() {
  const { requestSignOut, signingOut, dialog } = useSignOut()

  useEffect(() => {
    warmUpAccount()
  }, [])

  return (
    <Box component="main" sx={{ p: 4, pb: 8 }}>
      <Typography variant="h3" component="h1" sx={{ mb: 6 }}>
        Mi cuenta
      </Typography>
      <Stack spacing={4}>
        <ProfileSection />
        <OrganizationSection />
        <ImportSection />
      </Stack>
      <Button
        variant="outlined"
        size="large"
        fullWidth
        startIcon={<LogoutIcon />}
        loading={signingOut}
        loadingPosition="start"
        onClick={requestSignOut}
        sx={{ mt: 8 }}
      >
        Cerrar sesión
      </Button>
      {dialog}
    </Box>
  )
}

export default function Account() {
  return (
    <SessionGate needs="ready">
      <AccountScreen />
    </SessionGate>
  )
}
