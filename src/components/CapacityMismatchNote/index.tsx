import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

/**
 * Under a reading of a tank whose measures and capacity disagree (backend
 * specs/0018 RF-4): it was worked out with the measures, and one of the two
 * is wrong.
 */
export default function CapacityMismatchNote({
  actionLabel,
  onAction,
}: {
  actionLabel: string
  onAction: () => void
}) {
  return (
    <Box
      role="note"
      sx={{
        mt: 3,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
        color: 'error.main',
      }}
    >
      <ErrorOutlineIcon fontSize="small" aria-hidden="true" />
      <Box>
        <Typography variant="body2" sx={{ color: 'inherit' }}>
          Las medidas y la capacidad de este tanque no cuadran: revísalas. Este
          resultado sale de las medidas.
        </Typography>
        <Button size="small" onClick={onAction} sx={{ mt: 1, px: 0 }}>
          {actionLabel}
        </Button>
      </Box>
    </Box>
  )
}
