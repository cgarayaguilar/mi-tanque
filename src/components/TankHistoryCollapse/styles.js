import styled from 'styled-components'
import { focusRing, resetInteractive } from 'styles/interactive'
import { space } from 'theme/tokens'
import { px } from 'styles/type'

export const Wrapper = styled.section`
  margin-top: ${px(space.base)};
`

// voice-row from the design system: transparent row with a hairline divider
export const Header = styled.button`
  ${resetInteractive}
  ${focusRing}
  width: 100%;
  display: grid;
  grid-template-columns: min-content 1fr 24px;
  gap: ${px(space.sm)};
  align-items: center;
  padding: ${px(space.sm)} 0;
  border-bottom: 1px solid ${({ theme }) => theme.hairline};
`
export const List = styled.div`
  margin-top: ${px(space.base)};
`
