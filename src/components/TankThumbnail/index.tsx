import { memo } from 'react'
import Box from '@mui/material/Box'
import TankSolid from 'components/TankSolid'
import { projectTank } from 'utils/tankProjection'

export interface ThumbnailFrame {
  /** The projected size of the largest tank in the list. */
  width: number
  height: number
}

/** The frame that fits the largest diameter and length of a list. */
export const thumbnailFrame = (
  tanks: readonly { diameter: number; length: number }[]
): ThumbnailFrame => {
  const diameter = Math.max(1, ...tanks.map(tank => tank.diameter))
  const length = Math.max(1, ...tanks.map(tank => tank.length))
  const drawing = projectTank('cylinder', 'horizontal', {
    across: diameter,
    up: diameter,
    length,
  })
  return { width: drawing.width, height: drawing.height }
}

interface TankThumbnailProps {
  diameter: number
  length: number
  /** Shared by the whole list: a short tank looks shorter than a long one. */
  frame: ThumbnailFrame
  height?: number
}

/**
 * A horizontal cylinder in 3D at the list's scale, without dimension lines
 * (backend specs/0014 RF-2). Decorative: the card says the measures.
 */
function TankThumbnail({
  diameter,
  length,
  frame,
  height = 56,
}: TankThumbnailProps) {
  const drawing = projectTank('cylinder', 'horizontal', {
    across: diameter,
    up: diameter,
    length,
  })
  const margin = Math.max(frame.width, frame.height) * 0.04
  // Sitting at the bottom left of the shared frame
  const offsetY = frame.height - drawing.height
  return (
    <Box
      component="svg"
      aria-hidden="true"
      viewBox={`${String(-margin)} ${String(-margin)} ${String(frame.width + 2 * margin)} ${String(frame.height + 2 * margin)}`}
      preserveAspectRatio="xMinYMax meet"
      sx={{ display: 'block', width: '100%', height }}
    >
      <TankSolid drawing={drawing} at={([x, y]) => [x, y + offsetY]} thin />
    </Box>
  )
}

export default memo(TankThumbnail)
