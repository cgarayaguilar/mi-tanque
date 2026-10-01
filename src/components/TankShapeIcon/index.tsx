import Box from '@mui/material/Box'
import type { TankShape } from 'utils/tankVolume'

// Cross-section of each shape, as seen from the front (specs/0003)
const PATHS: Record<TankShape, string> = {
  cylinder: 'M24 6a18 18 0 1 1 0 36a18 18 0 1 1 0-36z',
  rectangular: 'M6 9h36v30H6z',
  // Flat side on the left (against the chassis), half circle on the right
  d_flat_side: 'M6 6h18a18 18 0 0 1 0 36H6z',
  // Flat bottom, half-circle top
  d_flat_bottom: 'M6 42V24a18 18 0 0 1 36 0v18z',
}

interface TankShapeIconProps {
  shape: TankShape
  size?: number
}

/** The tank's cross-section, drawn in the text color. Decorative. */
export default function TankShapeIcon({
  shape,
  size = 40,
}: TankShapeIconProps) {
  return (
    <Box
      component="svg"
      viewBox="0 0 48 48"
      aria-hidden="true"
      sx={{ width: size, height: size, flexShrink: 0, color: 'text.primary' }}
    >
      <path
        d={PATHS[shape]}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
    </Box>
  )
}
