import styled from 'styled-components'
import { space } from 'theme/tokens'
import { px } from 'styles/type'

export const Wrapper = styled.section`
  padding: ${px(space.base)};
`
export const Form = styled.form`
  display: flex;
  flex-direction: column;
`
export const TankContainer = styled.section`
  padding: ${px(space.base)} 0 ${px(space.lg)};
  display: flex;
  justify-content: center;
  align-items: center;
`

export const ButtonsContainer = styled.section`
  margin-top: ${px(space.lg)};
  display: flex;
  flex-direction: column;
  gap: ${px(space.xs)};
`
