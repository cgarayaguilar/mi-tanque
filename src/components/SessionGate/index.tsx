import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import EmptyState from 'components/EmptyState'
import { useSessionStore, type SessionStatus } from 'store/session'
import { radius } from 'theme/tokens'

interface SessionGateProps {
  /** The status this screen is for; the others are sent where they belong. */
  needs: Extract<SessionStatus, 'needsOnboarding' | 'ready'>
  children: ReactNode
}

const HOME_FOR: Partial<Record<SessionStatus, string>> = {
  signedOut: '/entrar',
  needsOnboarding: '/bienvenida',
  ready: '/cuenta',
}

/**
 * Screens of the signed-in mode: restores the session, shows loading and
 * error states, and redirects when the account is somewhere else (§8.2).
 */
export default function SessionGate({ needs, children }: SessionGateProps) {
  const status = useSessionStore(state => state.status)
  const start = useSessionStore(state => state.start)
  const refresh = useSessionStore(state => state.refresh)
  const [, navigate] = useLocation()

  useEffect(() => {
    void start()
  }, [start])

  const elsewhere = status !== needs ? HOME_FOR[status] : undefined
  useEffect(() => {
    if (elsewhere) navigate(elsewhere, { replace: true })
  }, [elsewhere, navigate])

  if (status === needs) return children

  if (status === 'error') {
    return (
      <EmptyState
        icon={<CloudOffIcon />}
        title="No pudimos cargar tu cuenta"
        description="Revisa tu conexión y vuelve a intentarlo."
        action={{ label: 'Reintentar', onClick: () => void refresh() }}
      />
    )
  }

  return (
    <Box sx={{ p: 4 }} aria-busy="true" aria-label="Cargando tu cuenta">
      <Skeleton variant="text" width="60%" height={40} />
      <Stack spacing={4} sx={{ mt: 6 }}>
        {[0, 1, 2].map(index => (
          <Skeleton
            key={index}
            variant="rounded"
            height={72}
            sx={{ borderRadius: `${String(radius.md)}px` }}
          />
        ))}
      </Stack>
    </Box>
  )
}
