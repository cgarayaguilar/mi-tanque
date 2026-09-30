import React from 'react'
import { Wrapper, Wave, FuelLevel } from './styles'

import { FaGasPump as FuelIcon } from 'react-icons/fa'
import Typography from 'components/Typography'

export default function TankAnimation({ fuelHeight = 0, gallons = 0 }) {
  return (
    <Wrapper>
      <FuelLevel>
        <FuelIcon size={32} />
        <Typography
          mt="8px"
          variant="body"
          value={`${Math.round(fuelHeight)}%`}
        />
        <Typography mt="8px" variant="title" value={`${gallons} gls`} />
      </FuelLevel>
      <Wave
        fuellevel={`${fuelHeight}%`}
        fill="#00A8CC"
        paused={false}
        options={{
          height: 5,
          amplitude: 20,
          speed: 0.15,
          points: 3,
        }}
      ></Wave>
    </Wrapper>
  )
}
