import Chip from '@mui/material/Chip'
import { TRIP_STATUS_LABELS, type TripStatus } from 'schemas/trips'

// In progress stands out; done and cancelled stay quiet (specs/0025 RF-6)
const COLORS: Record<TripStatus, 'default' | 'primary'> = {
  scheduled: 'default',
  in_progress: 'primary',
  done: 'default',
  cancelled: 'default',
}

/** A trip's status, in its list card and on its screen. */
export default function TripStatusChip({ status }: { status: TripStatus }) {
  return (
    <Chip
      label={TRIP_STATUS_LABELS[status]}
      size="small"
      color={COLORS[status]}
      variant={
        status === 'done' || status === 'in_progress' ? 'filled' : 'outlined'
      }
      sx={{
        alignSelf: 'flex-start',
        ...(status === 'cancelled' && { textDecoration: 'line-through' }),
      }}
    />
  )
}
