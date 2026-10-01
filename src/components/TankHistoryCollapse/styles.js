import styled from 'styled-components'
import { focusRing, resetInteractive } from 'styles/interactive'

export const Wrapper = styled.section`
  margin-top: 32px;
`
export const Header = styled.button`
  ${resetInteractive}
  ${focusRing}
  width: 100%;
  display: grid;
  grid-template-columns: min-content 1fr 24px;
  grid-gap: 8px;
  align-items: center;
  margin-top: 24px;
`
export const List = styled.div`
  margin-top: 32px;
  animation: 0.3s ease;
`
