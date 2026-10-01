import styled, { keyframes } from 'styled-components'
import Wave1 from 'react-wavify'
import { layout, radius, space } from 'theme/tokens'
import { px } from 'styles/type'

const tankSize = px(layout.gaugeSize)

const scaleUpBottom = keyframes`
   0% {
          transform: translateY(0)
    }

  100% {
      transform: translateY( ${({ fuellevel }) => fuellevel})
  }
`

export const Wave = styled(Wave1)`
  height: ${tankSize};
  width: ${tankSize};
  position: relative;

  svg {
    animation: ${scaleUpBottom} 3s cubic-bezier(0.39, 0.575, 0.565, 1) both;

    position: absolute;
    bottom: 0;
    height: ${({ fuellevel }) => fuellevel};
  }

  @media (prefers-reduced-motion: reduce) {
    svg {
      animation: none;
    }
  }
`

// Atmospheric orb from the design system: decoration only, behind the gauge
export const Gauge = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  padding: ${px(space.lg)} 0;
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in srgb, ${({ theme }) => theme.gradientSky} 45%, transparent) 0%,
    color-mix(in srgb, ${({ theme }) => theme.gradientMint} 25%, transparent)
      40%,
    transparent 70%
  );
`

export const Wrapper = styled.div`
  position: relative;
  background-color: ${({ theme }) => theme.cardStrong};
  border: 1px solid ${({ theme }) => theme.hairline};
  overflow: hidden;
  width: ${tankSize};
  height: ${tankSize};
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`

// Readable over the wave at any fill level: a surface badge on top of it
export const FuelLevel = styled.div`
  position: absolute;
  top: ${px(space.xl)};
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${px(space.xxs)};
  padding: ${px(space.xs)} ${px(space.lg)};
  background-color: ${({ theme }) => theme.card};
  border: 1px solid ${({ theme }) => theme.hairline};
  border-radius: ${px(radius.xl)};
  color: ${({ theme }) => theme.secondaryText};
`
