import styled from 'styled-components'
import { radius, space } from 'theme/tokens'
import { px } from 'styles/type'

// feature-card from the design system
export const Wrapper = styled.div`
  background-color: ${({ theme }) => theme.card};
  border: 1px solid ${({ theme }) => theme.hairline};
  border-radius: ${px(radius.xl)};
  padding: ${px(space.lg)};
  margin-top: ${px(space.base)};
`

export const Results = styled.div`
  margin-top: ${px(space.sm)};
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: ${px(space.xs)};

  div:last-of-type,
  div:nth-child(2) {
    text-align: center;
  }
`
