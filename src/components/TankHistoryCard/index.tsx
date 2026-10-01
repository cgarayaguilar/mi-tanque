import { useId, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MeasurementCard from 'components/MeasurementCard'
import Stat from 'components/Stat'
import TankDiagram from 'components/TankDiagram'
import { radius } from 'theme/tokens'
import type { TankHistory } from 'utils/measurementHistory'

interface TankHistoryCardProps {
  history: TankHistory
  defaultExpanded?: boolean
}

const plural = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`

/** "−10.00 gal." reads as fuel used; the caption says which way it went. */
const describeChange = (change: number, count: number) => {
  if (change < 0)
    return { value: Math.abs(change).toFixed(2), caption: 'gal. menos' }
  if (change > 0) return { value: change.toFixed(2), caption: 'gal. más' }
  return {
    value: '0.00',
    caption: count === 1 ? 'una sola medición' : 'sin cambios',
  }
}

/** A tank's period: summary figures and its measurements, newest first. */
export default function TankHistoryCard({
  history,
  defaultExpanded = false,
}: TankHistoryCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const titleId = useId()
  const listId = useId()
  const { tank, measurements, firstGallons, lastGallons, change } = history
  const count = measurements.length
  const difference = describeChange(change, count)

  return (
    <Box
      component="article"
      aria-labelledby={titleId}
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.xl)}px`,
        p: 4,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <TankDiagram
          capacity={tank.capacity}
          diameter={tank.diameter}
          length={tank.length}
        />
        <div>
          <Typography id={titleId} variant="subtitle1" component="h2">
            Tanque de {tank.capacity} gls
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {plural(count, 'medición', 'mediciones')}
          </Typography>
        </div>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          mt: 4,
        }}
      >
        <Stat
          size="small"
          label="Al inicio"
          value={firstGallons.toFixed(2)}
          caption="galones"
        />
        <Stat
          size="small"
          label="Al final"
          value={lastGallons.toFixed(2)}
          caption="galones"
        />
        <Stat
          size="small"
          label="Diferencia"
          value={difference.value}
          caption={difference.caption}
        />
      </Box>

      <Button
        fullWidth
        variant="outlined"
        onClick={() => {
          setExpanded(value => !value)
        }}
        aria-expanded={expanded}
        aria-controls={listId}
        endIcon={
          <ExpandMoreIcon
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s',
            }}
          />
        }
        sx={{ mt: 4 }}
      >
        {expanded
          ? 'Ocultar mediciones'
          : `Ver ${plural(count, 'medición', 'mediciones')}`}
      </Button>

      <Collapse in={expanded} id={listId}>
        <Box
          component="ul"
          aria-label={`Mediciones del tanque de ${String(tank.capacity)} galones`}
          sx={{
            listStyle: 'none',
            m: 0,
            mt: 2,
            p: 0,
            '& > li + li': { borderTop: 1, borderColor: 'divider' },
          }}
        >
          {measurements.map(measurement => (
            <li key={measurement.id}>
              <MeasurementCard measurement={measurement} tank={tank} />
            </li>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}
