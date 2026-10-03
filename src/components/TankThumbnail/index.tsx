import { memo } from 'react'
import Box from '@mui/material/Box'
import TankSolid from 'components/TankSolid'
import { projectTank, type PreviewSize } from 'utils/tankProjection'
import type { TankOrientation, TankShape } from 'utils/tankVolume'

export interface ThumbnailFrame {
  /** The projected size of the largest tank in the list. */
  width: number
  height: number
}

/** What a thumbnail needs: the shape and its sizes, in inches. */
export interface ThumbnailTank {
  shape: TankShape
  /** Lying unless said (the catalog's are; a phone's may stand, specs/0019). */
  orientation?: TankOrientation
  /** A cylinder's diameter, or the height of a "D" or a box. */
  size: number
  width: number | null
  length: number
}

// A 56px drawing needs far fewer faces than the large preview
const THUMBNAIL_STEPS = 10

/** Across, up and length, as the projection takes them. */
const previewSize = (tank: ThumbnailTank): PreviewSize => ({
  across: tank.width ?? tank.size,
  up: tank.size,
  length: tank.length,
})

/** The frame that fits every tank of a list, at one scale. */
export const thumbnailFrame = (
  tanks: readonly ThumbnailTank[]
): ThumbnailFrame => {
  let width = 1
  let height = 1
  for (const tank of tanks) {
    const drawing = projectTank(
      tank.shape,
      tank.orientation ?? 'horizontal',
      previewSize(tank),
      THUMBNAIL_STEPS
    )
    width = Math.max(width, drawing.width)
    height = Math.max(height, drawing.height)
  }
  return { width, height }
}

interface TankThumbnailProps {
  tank: ThumbnailTank
  /** Shared by the whole list: a short tank looks shorter than a long one. */
  frame: ThumbnailFrame
  height?: number
}

/**
 * The tank in 3D at the list's scale, in its own shape, without dimension
 * lines (backend specs/0014 RF-2, specs/0015 RF-8). Decorative: the card
 * says the measures.
 */
function TankThumbnail({ tank, frame, height = 56 }: TankThumbnailProps) {
  const drawing = projectTank(
    tank.shape,
    tank.orientation ?? 'horizontal',
    previewSize(tank),
    THUMBNAIL_STEPS
  )
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
