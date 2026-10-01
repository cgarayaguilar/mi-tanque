import styled from 'styled-components'
import { focusRing, resetInteractive } from 'styles/interactive'

export const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
`

export const Logo = styled.a`
  ${resetInteractive}
  ${focusRing}
  display: flex;
  align-items: center;
`
