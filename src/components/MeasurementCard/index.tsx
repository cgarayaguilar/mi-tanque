import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import PlaceIcon from '@mui/icons-material/Place'
import { colorTokens, radius, typeScale } from 'theme/tokens'
import type { Measurement, Tank } from 'types'
import { formatMeasurementDate } from 'utils/formatDate'
import { formatNumber } from 'utils/formatNumber'
import { fillPercent } from 'utils/measurementHistory'

interface MeasurementCardProps {
  measurement: Measurement
  tank: Tank
}

/**
 * One measurement of the history in three short lines (when and how full,
 * the amounts, where), so a week of readings fits on a phone screen.
 */
export default function MeasurementCard({
  measurement,
  tank,
}: MeasurementCardProps) {
  const { date, location, inches, gallons, liters } = measurement
  const percent = fillPercent(measurement, tank)

  return (
    <Box sx={{ py: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 2,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          <time dateTime={date.toISOString()}>
            {formatMeasurementDate(date)}
          </time>
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.primary', fontWeight: 600 }}
        >
          {percent}%
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          columnGap: 2,
          mt: 1,
        }}
      >
        <Typography
          component="span"
          sx={{ ...typeScale.figureSm, color: 'text.primary' }}
        >
          {formatNumber(gallons, 2)} gal
        </Typography>
        {/* Not laid out in a flex row, but keeps the words apart when read */}{' '}
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          de {formatNumber(tank.capacity)} · {formatNumber(liters, 2)} L ·{' '}
          {formatNumber(inches)} pulg.
        </Typography>
      </Box>

      <LinearProgress
        variant="determinate"
        value={percent}
        aria-label={`Nivel del tanque: ${String(percent)}%`}
        sx={{
          my: 2,
          height: 4,
          borderRadius: `${String(radius.pill)}px`,
          bgcolor: theme => colorTokens[theme.palette.mode].surfaceStrong,
        }}
      />

      <Typography
        variant="caption"
        component="p"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: 'text.secondary',
          '& svg': { fontSize: 14 },
        }}
      >
        <PlaceIcon aria-hidden="true" />
        {location}
      </Typography>
    </Box>
  )
}
