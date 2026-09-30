import React from 'react'
import TankIcon from 'assets/tank.svg?react'

import {
  TankContainer,
  TankCapacity,
  TankDiameter,
  TankLength,
  HorizontalLine,
  VerticalLine,
  Wrapper,
  Caption,
} from './styles'

export default function Tank({
  capacity,
  diameter,
  length,
  lineWidth = '1px',
}) {
  return (
    <Wrapper>
      <TankDiameter>
        <VerticalLine lineWidth={lineWidth} top={true}></VerticalLine>
        <Caption>{diameter}</Caption>
        <VerticalLine lineWidth={lineWidth} top={false}></VerticalLine>
      </TankDiameter>
      <TankContainer>
        <TankIcon />
        <TankCapacity>{capacity}</TankCapacity>
      </TankContainer>

      <TankLength>
        <HorizontalLine lineWidth={lineWidth} right={false}></HorizontalLine>
        <Caption>{length}</Caption>
        <HorizontalLine lineWidth={lineWidth} right={true}></HorizontalLine>
      </TankLength>
    </Wrapper>
  )
}
