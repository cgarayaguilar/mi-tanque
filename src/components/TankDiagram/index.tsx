import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import TankIcon from 'assets/tank.svg?react'
import { typeScale } from 'theme/tokens'
import { formatNumber } from 'utils/formatNumber'

// Illustration geometry (px): the cylinder drawing and its dimension arrows
const TANK_WIDTH = 94
const TANK_HEIGHT = 50
const ARROW = 3

const Dimension = styled('span')(({ theme }) => ({
  ...typeScale.captionUppercase,
  color: theme.palette.text.secondary,
  lineHeight: 1,
}))

/** A dimension line with arrowheads at both ends, horizontal or vertical. */
const DimensionLine = styled('span', {
  shouldForwardProp: prop => prop !== 'vertical',
})<{ vertical?: boolean }>(({ theme, vertical = false }) => {
  const arrow = (side: 'start' | 'end') => {
    const pointsTo = vertical
      ? side === 'start'
        ? 'Bottom'
        : 'Top'
      : side === 'start'
        ? 'Right'
        : 'Left'

    return {
      content: '""',
      position: 'absolute' as const,
      [vertical
        ? side === 'start'
          ? 'top'
          : 'bottom'
        : side === 'start'
          ? 'left'
          : 'right']: -ARROW,
      // Centered on the 1px line across its axis
      [vertical ? 'left' : 'top']: -ARROW + 0.5,
      border: `${String(ARROW)}px solid transparent`,
      [`border${pointsTo}Color`]: theme.palette.text.secondary,
    }
  }

  return {
    position: 'relative',
    flex: 1,
    alignSelf: 'center',
    backgroundColor: theme.palette.text.secondary,
    ...(vertical ? { width: 1, minHeight: 8 } : { height: 1, minWidth: 8 }),
    '&::before': arrow('start'),
    '&::after': arrow('end'),
  }
})

interface TankDiagramProps {
  capacity: number | string
  diameter: number | string
  length: number | string
}

/** Cylinder with its capacity and dimension callouts (diameter and length). */
/** Numbers in Spanish format; text (what the user is typing) as it is. */
const show = (value: number | string) =>
  typeof value === 'number' ? formatNumber(value) : value

export default function TankDiagram(props: TankDiagramProps) {
  const capacity = show(props.capacity)
  const diameter = show(props.diameter)
  const length = show(props.length)
  return (
    <Box
      role="img"
      aria-label={`Tanque de ${capacity} galones, ${diameter} pulgadas de diámetro y ${length} de largo`}
      sx={{
        display: 'grid',
        gridTemplateColumns: `min-content ${String(TANK_WIDTH)}px`,
        gridTemplateRows: `${String(TANK_HEIGHT)}px min-content`,
        gap: 1,
        flexShrink: 0,
      }}
    >
      <Box
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <DimensionLine vertical />
        <Dimension>{diameter}</Dimension>
        <DimensionLine vertical />
      </Box>

      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.primary',
        }}
      >
        <TankIcon aria-hidden="true" />
        <Box
          component="span"
          sx={{ ...typeScale.bodyStrong, position: 'absolute' }}
        >
          {capacity} gls
        </Box>
      </Box>

      <Box
        sx={{ gridColumn: 2, display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <DimensionLine />
        <Dimension>{length}</Dimension>
        <DimensionLine />
      </Box>
    </Box>
  )
}
