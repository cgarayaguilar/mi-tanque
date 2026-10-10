import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation } from 'wouter'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AutocompleteField from 'components/AutocompleteField'
import SessionGate from 'components/SessionGate'
import TextField from 'components/TextField'
import { useOnlineStatus } from 'hooks/useOnlineStatus'
import {
  CURRENCY_OPTIONS,
  welcomeFormSchema,
  type WelcomeFormValues,
} from 'schemas/account'
import { warmUpAccount } from 'services/session'
import { useSessionStore } from 'store/session'
import { authErrorMessage } from 'utils/authErrors'
import { currencyForPhone } from 'utils/phoneCountries'
import { reportError } from 'utils/reportError'
import { usableName } from 'utils/personName'

const suggestedOrgName = (name: string | undefined) => {
  const first = name?.trim().split(/\s+/)[0]
  return first ? `Flota de ${first}` : ''
}

function WelcomeForm() {
  const user = useSessionStore(state => state.user)
  // Someone who left (or was removed from) their last organization keeps
  // their profile: only the organization is asked again (specs/0005)
  const profileName = useSessionStore(state => state.profile?.displayName)
  const completeOnboarding = useSessionStore(state => state.completeOnboarding)
  const [, navigate] = useLocation()
  const online = useOnlineStatus()
  // Google brings a name; a phone sign-in does not (specs/0002 RF-7)
  // Held to 2–60 characters like a typed one; a Google name of one letter
  // is asked for again
  const knownName = usableName(user?.displayName) ?? usableName(profileName)
  const asksName = !knownName
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<WelcomeFormValues>({
    resolver: zodResolver(welcomeFormSchema),
    defaultValues: {
      ...(asksName && { displayName: '' }),
      orgName: suggestedOrgName(knownName ?? undefined),
      currency: currencyForPhone(user?.phoneNumber ?? null) ?? 'USD',
    },
  })
  const typedName = useWatch({ control, name: 'displayName' })

  useEffect(() => {
    warmUpAccount()
  }, [])

  // Suggest the organization's name from the typed name until the user
  // writes their own
  useEffect(() => {
    if (asksName && !dirtyFields.orgName) {
      setValue('orgName', suggestedOrgName(typedName))
    }
  }, [asksName, typedName, dirtyFields.orgName, setValue])

  const onSubmit = async (values: WelcomeFormValues) => {
    try {
      const displayName = asksName
        ? values.displayName
        : (usableName(profileName) ?? undefined)
      await completeOnboarding({
        ...(displayName !== undefined && { displayName }),
        orgName: values.orgName,
        currency: values.currency,
      })
      sileo.success({
        title: 'Tu organización está lista',
        description: values.orgName,
      })
      navigate('/', { replace: true })
    } catch (error) {
      reportError(error, { operation: 'bootstrapAccount' })
      sileo.error({
        title: 'No pudimos crear tu organización',
        description: authErrorMessage(error),
      })
    }
  }

  return (
    <Box component="main" sx={{ p: 4, pb: 8 }}>
      <Typography variant="pageTitle">Te damos la bienvenida</Typography>
      <Typography variant="body2" sx={{ mt: 1, mb: 6 }}>
        Crea tu organización: ahí guardarás tus camiones, tanques y mediciones,
        y podrás invitar a tu equipo.
      </Typography>

      <Box
        component="form"
        noValidate
        aria-label="Crear tu organización"
        onSubmit={event => {
          void handleSubmit(onSubmit)(event)
        }}
      >
        <Stack spacing={5}>
          {asksName && (
            <TextField
              id="displayName"
              label="¿Cómo te llamas?"
              placeholder="Juan Pérez"
              autoComplete="name"
              hint="Así te verá tu equipo en las mediciones."
              error={errors.displayName?.message}
              registration={register('displayName')}
            />
          )}
          <TextField
            id="orgName"
            label="Nombre de tu organización"
            placeholder="Flota de Juan"
            autoComplete="organization"
            hint="Puede ser tu empresa o tu propio nombre. Lo puedes cambiar luego."
            error={errors.orgName?.message}
            registration={register('orgName')}
          />
          <AutocompleteField
            id="currency"
            label="Moneda"
            options={CURRENCY_OPTIONS}
            hint="Para el costo de los rellenos de combustible."
            error={errors.currency?.message}
            control={control}
            name="currency"
          />
        </Stack>

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          loading={isSubmitting}
          loadingPosition="start"
          disabled={!online}
          sx={{ mt: 8 }}
        >
          {isSubmitting ? 'Creando…' : 'Empezar'}
        </Button>
        {!online && (
          <Typography
            role="status"
            variant="caption"
            component="p"
            sx={{ mt: 2, color: 'text.secondary', textAlign: 'center' }}
          >
            Necesitas conexión para crear tu organización.
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export default function Welcome() {
  return (
    <SessionGate needs="needsOnboarding">
      <WelcomeForm />
    </SessionGate>
  )
}
