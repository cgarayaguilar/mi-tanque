import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { useTripMeasurements } from 'hooks/useTripMeasurements'
import { formatMeasurementDate } from 'utils/formatDate'
import { formatNumber } from 'utils/formatNumber'
import { RETRY_HINT } from 'utils/withTimeout'

/** "Mediciones" of a trip (backend specs/0042 RF-6). */
export default function TripMeasurements({
  orgId,
  tripId,
}: {
  orgId: string
  tripId: string
}) {
  const [status, measurements, retry] = useTripMeasurements(orgId, tripId)

  return (
    <Box component="section" aria-labelledby="trip-measurements-title">
      <Typography
        id="trip-measurements-title"
        variant="overline"
        component="h2"
        sx={{ color: 'text.secondary' }}
      >
        {status === 'ready' && measurements.length > 0
          ? `Mediciones (${String(measurements.length)})`
          : 'Mediciones'}
      </Typography>
      {status === 'error' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No pudimos cargar las mediciones. {RETRY_HINT}
          </Typography>
          <Button onClick={retry} sx={{ ml: -2 }}>
            Reintentar
          </Button>
        </Box>
      )}
      {status === 'loading' && (
        <Skeleton variant="rounded" height={64} sx={{ mt: 2 }} />
      )}
      {status === 'ready' &&
        (measurements.length === 0 ? (
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            Aún no hay mediciones en este viaje.
          </Typography>
        ) : (
          <Box
            component="ul"
            aria-label="Mediciones del viaje"
            sx={{
              listStyle: 'none',
              m: 0,
              mt: 2,
              p: 0,
              '& > li + li': { borderTop: 1, borderColor: 'divider' },
            }}
          >
            {measurements.map(measurement => (
              <Box
                component="li"
                key={measurement.id}
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 2,
                  py: 2,
                }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    {measurement.tankName}
                    {measurement.equipment.name &&
                      ` · ${measurement.equipment.name}`}
                  </Typography>
                  <Typography
                    variant="caption"
                    component="p"
                    sx={{ color: 'text.secondary' }}
                  >
                    <time dateTime={measurement.takenAt.toISOString()}>
                      {formatMeasurementDate(measurement.takenAt)}
                    </time>{' '}
                    · {measurement.userName}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.primary', whiteSpace: 'nowrap' }}
                >
                  {formatNumber(measurement.gallons, 1)} gal ·{' '}
                  {formatNumber(Math.round(measurement.fillPercent))} %
                </Typography>
              </Box>
            ))}
          </Box>
        ))}
    </Box>
  )
}
