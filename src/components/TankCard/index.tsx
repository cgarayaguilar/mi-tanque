import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { radius, softShadow, typeScale } from 'theme/tokens'
import type { TankDimensions } from 'types'
import { formatNumber } from 'utils/formatNumber'

interface TankCardProps {
  tank: TankDimensions
  /** Verb used in the accessible name, e.g. "Seleccionar". */
  actionLabel: string
  /** The tank the user measures now. */
  selected?: boolean
  onClick: () => void
}

/**
 * Compact tile (DESIGN.md, Tarjeta de tanque): capacity first, then the
 * dimensions. Two per row on a phone, so the list of tanks stays short.
 */
export default function TankCard({
  tank,
  actionLabel,
  selected = false,
  onClick,
}: TankCardProps) {
  const capacity = formatNumber(tank.capacity)
  const diameter = formatNumber(tank.diameter)
  const length = formatNumber(tank.length)

  return (
    <ButtonBase
      onClick={onClick}
      aria-label={`${actionLabel}: tanque de ${capacity} galones, ${diameter} por ${length} pulgadas`}
      aria-current={selected ? 'true' : undefined}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'flex-start',
        px: 4,
        py: 3,
        textAlign: 'left',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: selected ? 'text.primary' : 'divider',
        // Same footprint selected or not: the ring is drawn inside
        boxShadow: selected
          ? theme => `inset 0 0 0 1px ${theme.palette.text.primary}`
          : 'none',
        borderRadius: `${String(radius.lg)}px`,
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: selected ? undefined : softShadow },
      }}
    >
      {selected && (
        <CheckCircleIcon
          aria-hidden="true"
          sx={{ position: 'absolute', top: 12, right: 12, fontSize: 18 }}
        />
      )}
      <Typography
        component="span"
        sx={{ ...typeScale.figureMd, color: 'text.primary' }}
      >
        {capacity} gls
      </Typography>
      <Typography
        component="span"
        variant="caption"
        sx={{ color: 'text.secondary' }}
      >
        {diameter} × {length} pulg.
      </Typography>
    </ButtonBase>
  )
}
