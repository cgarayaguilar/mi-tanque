import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import { useSessionStore } from 'store/session'
import { radius } from 'theme/tokens'

/**
 * Shown on Medición and Historial when the account could not load: they keep
 * working on this phone (a driver without signal still measures), but no
 * longer as if the data went to the organization (audit 2026-10-01 #17).
 */
export default function SessionErrorNotice() {
  const status = useSessionStore(state => state.status)
  const refresh = useSessionStore(state => state.refresh)
  if (status !== 'error') return null
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 3,
        mb: 4,
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.md)}px`,
      }}
    >
      <CloudOffIcon sx={{ color: 'text.secondary' }} />
      <Typography variant="body2" sx={{ flexGrow: 1 }}>
        No pudimos cargar tu cuenta. Lo que guardes ahora queda solo en este
        teléfono.
      </Typography>
      <Button size="small" onClick={() => void refresh()}>
        Reintentar
      </Button>
    </Box>
  )
}
