import Box from '@mui/material/Box'
import type { Swatch } from 'schemas/fleet'
import { vehicleSwatches } from 'theme/tokens'

interface ColorDotProps {
  swatch: Swatch | null | undefined
  size?: number
}

/**
 * A vehicle's paint color. "Other" and no color show an empty ring: the name
 * next to it says which. Decorative (the color is also written).
 */
export default function ColorDot({ swatch, size = 16 }: ColorDotProps) {
  const fill =
    swatch && swatch !== 'other' ? vehicleSwatches[swatch] : 'transparent'
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        display: 'inline-block',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: fill,
        border: 1,
        borderColor: 'text.secondary',
      }}
    />
  )
}
