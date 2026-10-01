import styled from 'styled-components'
import { focusRing, resetInteractive } from 'styles/interactive'
import { layout, space } from 'theme/tokens'
import { px } from 'styles/type'

// top-nav from the design system: canvas background, ink, 64px
export const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: ${px(layout.appBarHeight)};
  padding: 0 ${px(space.base)};
  background-color: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.primaryText};
`

export const Logo = styled.a`
  ${resetInteractive}
  ${focusRing}
  display: flex;
  align-items: center;
  gap: ${px(space.xs)};
  color: ${({ theme }) => theme.primaryText};
`
