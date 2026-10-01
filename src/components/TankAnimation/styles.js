import styled, { keyframes } from 'styled-components'
import Wave1 from 'react-wavify'

const tankSize = '250px'

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
`

export const Wrapper = styled.div`
  background-color: ${({ theme }) => theme.card};
  margin: auto;
  overflow: hidden;
  width: ${tankSize};
  height: ${tankSize};
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`

export const FuelLevel = styled.div`
  align-items: center;
  /* Colors the pump icon; theme.textSecondary did not exist, so it always
     inherited the primary text color: keep that look explicitly */
  color: ${({ theme }) => theme.primaryText};
  display: flex;
  flex-direction: column;
  margin-top: 20px;
  position: absolute;
  z-index: 99;
`
