import styled from 'styled-components'
import { focusRing, resetInteractive } from 'styles/interactive'

export const Card = styled.button`
  ${resetInteractive}
  ${focusRing}
  width: 100%;
  background: ${({ theme }) => theme.card};
  border-radius: 8px;
  padding: 8px;
  display: grid;
  grid-template-columns: min-content 1fr;
  grid-gap: 8px;
  align-items: center;
`
