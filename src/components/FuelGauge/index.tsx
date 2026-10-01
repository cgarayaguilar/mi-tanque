import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import Wave from 'react-wavify'
import { colorTokens, layout, space, typeScale } from 'theme/tokens'
import type { FuelReading } from 'types'

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface FuelGaugeProps {
  /** null before the first calculation (partial state). */
  reading: FuelReading | null
}

/** Round gauge whose ink wave rises to the fill level (DESIGN.md, Medidor). */
export default function FuelGauge({ reading }: FuelGaugeProps) {
  const theme = useTheme()
  const color = colorTokens[theme.palette.mode]
  const fillPercent = reading ? Number(reading.fuelHeight) : 0

  return (
    <Box
      sx={{
        position: 'relative',
        isolation: 'isolate',
        display: 'flex',
        justifyContent: 'center',
        py: 8,
        // Atmospheric orb: a circle of its own that fades out inside itself
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '50%',
          left: '50%',
          zIndex: -1,
          width: layout.gaugeSize + 2 * space.xxl,
          maxWidth: '100%',
          aspectRatio: '1',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          pointerEvents: 'none',
          background: `radial-gradient(closest-side, color-mix(in srgb, ${color.gradientSky} 55%, transparent) 55%, color-mix(in srgb, ${color.gradientMint} 35%, transparent) 75%, transparent 100%)`,
        },
      }}
    >
      <Box
        role="img"
        aria-label={
          reading
            ? `Tanque al ${String(Math.round(fillPercent))}%: ${reading.gallons} galones`
            : 'Tanque sin medir'
        }
        sx={{
          position: 'relative',
          width: layout.gaugeSize,
          height: layout.gaugeSize,
          borderRadius: '50%',
          overflow: 'hidden',
          bgcolor: color.surfaceStrong,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            insetInline: 0,
            bottom: 0,
            height: `${String(fillPercent)}%`,
            transition: 'height 1.5s cubic-bezier(0.39, 0.575, 0.565, 1)',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        >
          <Wave
            fill={theme.palette.primary.main}
            paused={prefersReducedMotion()}
            options={{ height: 5, amplitude: 20, speed: 0.15, points: 3 }}
            style={{ display: 'flex', width: '100%', height: '100%' }}
          />
        </Box>

        {/* No container: difference blending inverts the white text against the
            light track or the ink wave, so it reads at any level and mode */}
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            color: color.differenceInk,
            mixBlendMode: 'difference',
            pointerEvents: 'none',
          }}
        >
          <LocalGasStationIcon sx={{ fontSize: space.base }} />
          {reading ? (
            <>
              <Typography
                component="span"
                variant="overline"
                sx={{ color: 'inherit' }}
              >
                {Math.round(fillPercent)}%
              </Typography>
              <Typography
                component="span"
                sx={{ ...typeScale.figureMd, color: 'inherit' }}
              >
                {reading.gallons} gls
              </Typography>
            </>
          ) : (
            <Typography
              component="span"
              variant="caption"
              sx={{ color: 'inherit' }}
            >
              Sin medir
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}
