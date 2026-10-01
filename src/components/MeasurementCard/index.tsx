import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import PlaceIcon from '@mui/icons-material/Place'
import Stat from 'components/Stat'
import { colorTokens, radius } from 'theme/tokens'
import type { Measurement, Tank } from 'types'
import { formatMeasurementDate } from 'utils/formatDate'
import { fillPercent } from 'utils/measurementHistory'
import { formatNumber } from 'utils/formatNumber'

interface MeasurementCardProps {
  measurement: Measurement
  tank: Tank
}

/** One measurement of the history: when, where, the reading and the fill bar. */
export default function MeasurementCard({
  measurement,
  tank,
}: MeasurementCardProps) {
  const { date, location, inches, gallons, liters } = measurement
  const percent = fillPercent(measurement, tank)

  return (
    <Box sx={{ py: 4 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          columnGap: 4,
          rowGap: 1,
          color: 'text.secondary',
          '& svg': { fontSize: 16 },
        }}
      >
        <Typography
          variant="caption"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <CalendarTodayIcon aria-hidden="true" />
          <time dateTime={date.toISOString()}>
            {formatMeasurementDate(date)}
          </time>
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <PlaceIcon aria-hidden="true" />
          {location}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          my: 3,
        }}
      >
        <Stat size="small" label="Pulgadas" value={formatNumber(inches)} />
        <Stat size="small" label="Galones" value={formatNumber(gallons, 2)} />
        <Stat size="small" label="Litros" value={formatNumber(liters, 2)} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography
          variant="caption"
          sx={{ color: 'text.primary', fontWeight: 600, minWidth: '4ch' }}
        >
          {percent}%
        </Typography>
        <LinearProgress
          variant="determinate"
          value={percent}
          aria-label={`Nivel del tanque: ${String(percent)}%`}
          sx={{
            flexGrow: 1,
            height: 4,
            borderRadius: `${String(radius.pill)}px`,
            bgcolor: theme => colorTokens[theme.palette.mode].surfaceStrong,
          }}
        />
      </Box>
      <Typography
        variant="caption"
        component="p"
        sx={{ color: 'text.secondary', mt: 1 }}
      >
        {formatNumber(gallons, 2)} de {formatNumber(tank.capacity)} galones
      </Typography>
    </Box>
  )
}
