import styled from 'styled-components'
import { radius, space, typeScale } from 'theme/tokens'
import { px, typeStyle } from 'styles/type'

const badgeSize = px(space.lg)

export const StepContainer = styled.form`
  max-width: 100%;
  display: flex;
  flex-direction: column;
`
export const Step = styled.div`
  margin-bottom: ${px(space.sm)};
  display: grid;
  grid-template-columns: ${badgeSize} 1fr;
  gap: ${px(space.sm)};
`
export const BadgeContainer = styled.div`
  display: grid;
  grid-template-rows: ${badgeSize} 1fr;
  justify-items: center;
`

export const Line = styled.div`
  width: 1px;
  height: 100%;
  background-color: ${({ theme }) => theme.hairline};
`

// badge-pill from the design system: ink when the step is done
export const Badge = styled.div`
  ${typeStyle(typeScale.captionUppercase)}
  width: ${badgeSize};
  height: ${badgeSize};
  border-radius: ${px(radius.pill)};
  background-color: ${({ theme, completed }) =>
    completed ? theme.accent : theme.cardStrong};
  color: ${({ theme, completed }) =>
    completed ? theme.onAccent : theme.secondaryText};
  display: flex;
  justify-content: center;
  align-items: center;
`
