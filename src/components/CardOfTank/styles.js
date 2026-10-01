import styled from 'styled-components'
import { focusRing, resetInteractive } from 'styles/interactive'
import { radius, softShadow, space } from 'theme/tokens'
import { px } from 'styles/type'

// Compact card: surface, 1px hairline, rounded lg; the soft shadow is the
// system's single elevation tier and appears on hover only
export const Card = styled.button`
  ${resetInteractive}
  ${focusRing}
  width: 100%;
  background: ${({ theme }) => theme.card};
  border: 1px solid ${({ theme }) => theme.hairline};
  border-radius: ${px(radius.lg)};
  padding: ${px(space.sm)};
  display: grid;
  grid-template-columns: min-content 1fr;
  gap: ${px(space.sm)};
  align-items: center;
  transition: box-shadow 0.15s;

  &:hover {
    box-shadow: ${softShadow};
  }
`
