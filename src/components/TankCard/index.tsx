import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import TankDiagram from 'components/TankDiagram'
import { radius, softShadow } from 'theme/tokens'
import type { TankDimensions } from 'types'

interface TankCardProps {
  tank: TankDimensions
  /** Call to action shown in the card and used in its accessible name. */
  actionLabel: string
  onClick: () => void
}

/** Compact card (DESIGN.md): the whole card is the button. */
export default function TankCard({
  tank,
  actionLabel,
  onClick,
}: TankCardProps) {
  const { capacity, diameter, length } = tank

  return (
    <ButtonBase
      onClick={onClick}
      aria-label={`${actionLabel}: tanque de ${String(capacity)} galones, ${String(diameter)} por ${String(length)} pulgadas`}
      sx={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'min-content 1fr',
        alignItems: 'center',
        gap: 3,
        p: 3,
        textAlign: 'left',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.lg)}px`,
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: softShadow },
      }}
    >
      <TankDiagram capacity={capacity} diameter={diameter} length={length} />
      <span>
        <Typography
          component="span"
          variant="subtitle1"
          sx={{ display: 'block', mb: 1 }}
        >
          Tanque de {capacity} gls
        </Typography>
        <Typography
          component="span"
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary' }}
        >
          Diámetro: {diameter} pulgadas
        </Typography>
        <Typography
          component="span"
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', mb: 2 }}
        >
          Longitud: {length} pulgadas
        </Typography>
        <Typography
          component="span"
          variant="button"
          sx={{
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            color: 'text.primary',
          }}
        >
          {actionLabel}
        </Typography>
      </span>
    </ButtonBase>
  )
}
