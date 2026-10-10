import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation, useParams } from 'wouter'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import EmptyState from 'components/EmptyState'
import TextField from 'components/TextField'
import { useOnlineStatus } from 'hooks/useOnlineStatus'
import {
  joinFormSchema,
  profileFormSchema,
  type ProfileFormValues,
} from 'schemas/account'
import {
  callTeam,
  previewInvitation,
  type InvitationPreview,
} from 'services/team'
import { useSessionStore } from 'store/session'
import { radius } from 'theme/tokens'
import { formatMeasurementDate } from 'utils/formatDate'
import { forgetInvitation, rememberInvitation } from 'utils/pendingInvitation'
import { reportError } from 'utils/reportError'
import { ROLE_LABELS, type InvitableRole } from 'utils/roles'
import {
  teamErrorDetails,
  teamErrorMessage,
  teamErrorReason,
} from 'utils/teamErrors'

// 32 random bytes in base64url (backend specs/0005 RF-1)
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

const ROLE_SUMMARY: Record<InvitableRole, string> = {
  supervisor:
    'Podrás administrar la flota, medir, corregir mediciones y sumar choferes.',
  driver: 'Podrás medir los tanques y administrar la flota.',
  viewer: 'Podrás ver la flota y el historial, sin hacer cambios.',
}

type View =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'offline' }
  | { kind: 'ready'; preview: InvitationPreview }

function JoinForm({
  token,
  preview,
  onFailed,
}: {
  token: string
  preview: InvitationPreview
  onFailed: () => void
}) {
  const status = useSessionStore(state => state.status)
  const user = useSessionStore(state => state.user)
  const hasProfile = useSessionStore(state => state.profile !== null)
  const refresh = useSessionStore(state => state.refresh)
  const switchOrganization = useSessionStore(state => state.switchOrganization)
  const [, navigate] = useLocation()
  const online = useOnlineStatus()
  // A first sign-in only gives a name: no personal organization (RF-4)
  const asksName =
    status === 'needsOnboarding' && !hasProfile && !user?.displayName
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(asksName ? profileFormSchema : joinFormSchema),
    defaultValues: { displayName: '' },
  })

  const contact = user
    ? user.phoneNumber
      ? 'tu teléfono'
      : 'tu correo'
    : 'tu teléfono o correo'
  const notice = `Tu equipo verá tu nombre y ${contact}.`

  if (status === 'signedOut') {
    return (
      <>
        <Typography variant="body2" sx={{ mb: 4 }}>
          {notice}
        </Typography>
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={() => {
            rememberInvitation(token)
            navigate('/entrar')
          }}
        >
          Entrar para unirme
        </Button>
      </>
    )
  }

  const join = async ({ displayName }: ProfileFormValues) => {
    try {
      await callTeam({
        action: 'acceptInvitation',
        token,
        ...(asksName && { displayName }),
      })
      forgetInvitation()
      await refresh()
      sileo.success({ title: `Te uniste a ${preview.orgName}` })
      navigate('/', { replace: true })
    } catch (error) {
      if (teamErrorReason(error) === 'already-member') {
        forgetInvitation()
        const { orgId } = teamErrorDetails(error)
        if (typeof orgId === 'string') await switchOrganization(orgId)
        sileo.success({ title: `Ya eres parte de ${preview.orgName}` })
        navigate('/', { replace: true })
        return
      }
      reportError(error, { operation: 'acceptInvitation' })
      sileo.error({
        title: 'No pudimos unirte',
        description: teamErrorMessage(error),
      })
      onFailed()
    }
  }

  return (
    <Box
      component="form"
      noValidate
      aria-label="Unirme a la organización"
      onSubmit={event => {
        void handleSubmit(join)(event)
      }}
    >
      {asksName && (
        <Box sx={{ mb: 4 }}>
          <TextField
            id="displayName"
            label="¿Cómo te llamas?"
            placeholder="Juan Pérez"
            autoComplete="name"
            hint="Así te verá tu equipo en las mediciones."
            error={errors.displayName?.message}
            registration={register('displayName')}
          />
        </Box>
      )}
      <Typography variant="body2" sx={{ mb: 4 }}>
        {notice}
      </Typography>
      <Stack spacing={2}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          loading={isSubmitting}
          disabled={!online}
        >
          Unirme
        </Button>
        <Button
          size="large"
          fullWidth
          disabled={isSubmitting}
          onClick={() => {
            forgetInvitation()
            navigate('/', { replace: true })
          }}
        >
          Ahora no
        </Button>
      </Stack>
      {!online && (
        <Typography
          role="status"
          variant="caption"
          component="p"
          sx={{ mt: 2, color: 'text.secondary', textAlign: 'center' }}
        >
          Necesitas conexión para unirte.
        </Typography>
      )}
    </Box>
  )
}

/** Opens an invitation link (backend specs/0005 RF-4–RF-6). */
export default function Invitation() {
  const { token } = useParams<{ token: string }>()
  const status = useSessionStore(state => state.status)
  const uid = useSessionStore(state => state.user?.uid ?? null)
  const start = useSessionStore(state => state.start)
  const switchOrganization = useSessionStore(state => state.switchOrganization)
  const [, navigate] = useLocation()
  // One preview per token, session and retry; until it answers, loading
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${token}|${uid ?? ''}|${String(attempt)}`
  const [result, setResult] = useState<{ key: string; view: View } | null>(null)
  const validToken = TOKEN_PATTERN.test(token)
  const goHome = () => {
    navigate('/', { replace: true })
  }
  const retry = () => {
    setAttempt(value => value + 1)
  }

  useEffect(() => {
    if (status === 'loading') void start()
  }, [status, start])

  // After the session is known: "already a member" depends on it
  useEffect(() => {
    if (status === 'loading' || !validToken) return
    let active = true
    const settle = (view: View) => {
      if (active) setResult({ key: requestKey, view })
    }
    previewInvitation(token).then(
      preview => {
        settle({ kind: 'ready', preview })
      },
      (error: unknown) => {
        if (teamErrorReason(error) === 'invalid-invitation') {
          settle({ kind: 'invalid' })
          return
        }
        reportError(error, { operation: 'previewInvitation' })
        settle({ kind: 'offline' })
      }
    )
    return () => {
      active = false
    }
  }, [requestKey, status, token, validToken])

  const view: View = !validToken
    ? { kind: 'invalid' }
    : result?.key === requestKey
      ? result.view
      : { kind: 'loading' }
  // A link that cannot be used is not resumed after signing in
  const deadEnd =
    view.kind === 'invalid' ||
    (view.kind === 'ready' &&
      (view.preview.state !== 'pending' || view.preview.memberOrgId !== null))
  useEffect(() => {
    if (deadEnd) forgetInvitation()
  }, [deadEnd])

  if (view.kind === 'invalid') {
    return (
      <EmptyState
        icon={<LinkOffIcon />}
        title="Este enlace no es válido"
        description="Puede que lo hayan revocado o que esté incompleto. Pide un enlace nuevo a tu equipo."
        action={{ label: 'Ir al inicio', onClick: goHome }}
      />
    )
  }
  if (view.kind === 'offline') {
    return (
      <EmptyState
        icon={<CloudOffIcon />}
        title="No pudimos abrir la invitación"
        description="Revisa tu conexión y vuelve a intentarlo."
        action={{ label: 'Reintentar', onClick: retry }}
      />
    )
  }
  if (view.kind === 'loading' || status === 'loading') {
    return (
      <Box sx={{ p: 4 }} aria-busy="true" aria-label="Abriendo la invitación">
        <Skeleton variant="text" width="70%" height={40} />
        <Skeleton variant="text" width="90%" />
        <Skeleton
          variant="rounded"
          height={48}
          sx={{ mt: 6, borderRadius: `${String(radius.pill)}px` }}
        />
      </Box>
    )
  }

  const { preview } = view
  if (preview.memberOrgId) {
    const orgId = preview.memberOrgId
    return (
      <EmptyState
        icon={<GroupAddIcon />}
        title={`Ya eres parte de ${preview.orgName}`}
        description="Este enlace no te hace falta."
        action={{
          label: `Ir a ${preview.orgName}`,
          onClick: () => {
            void switchOrganization(orgId).then(goHome)
          },
        }}
      />
    )
  }
  if (preview.state !== 'pending') {
    return (
      <EmptyState
        icon={<LinkOffIcon />}
        title={
          preview.state === 'expired'
            ? 'Este enlace venció'
            : 'Este enlace ya se usó'
        }
        description={
          preview.state === 'expired'
            ? `Las invitaciones duran 7 días. Pide un enlace nuevo a ${preview.invitedBy}.`
            : `Cada enlace sirve para una persona. Pide uno nuevo a ${preview.invitedBy}.`
        }
        action={{ label: 'Ir al inicio', onClick: goHome }}
      />
    )
  }

  return (
    <Box component="main" sx={{ p: 4, pb: 8 }}>
      <Typography variant="pageTitle">
        Te invitan a {preview.orgName}
      </Typography>
      <Typography variant="body1" sx={{ mt: 2 }}>
        {preview.invitedBy} te invita a unirte como{' '}
        <strong>{ROLE_LABELS[preview.role]}</strong>.{' '}
        {ROLE_SUMMARY[preview.role]}
      </Typography>
      <Typography
        variant="caption"
        component="p"
        sx={{ mt: 1, mb: 6, color: 'text.secondary' }}
      >
        El enlace vence el {formatMeasurementDate(new Date(preview.expiresAt))}.
      </Typography>
      <JoinForm token={token} preview={preview} onFailed={retry} />
    </Box>
  )
}
