import { useTheme } from 'styled-components'
import { FaGasPump as FuelIcon } from 'react-icons/fa'
import Typography from 'components/Typography'
import { Gauge, Wrapper, Wave, FuelLevel } from './styles'

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export default function TankAnimation({ fuelHeight = 0, gallons = 0 }) {
  const theme = useTheme()

  return (
    <Gauge>
      <Wrapper>
        <FuelLevel>
          <FuelIcon size={16} aria-hidden="true" />
          <Typography
            variant="caption2"
            color="inherit"
            value={`${Math.round(fuelHeight)}%`}
          />
          <Typography
            variant="figure"
            color="inherit"
            value={`${gallons} gls`}
          />
        </FuelLevel>
        <Wave
          fuellevel={`${fuelHeight}%`}
          fill={theme.accent}
          paused={prefersReducedMotion()}
          options={{
            height: 5,
            amplitude: 20,
            speed: 0.15,
            points: 3,
          }}
        ></Wave>
      </Wrapper>
    </Gauge>
  )
}
