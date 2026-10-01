import styled from 'styled-components'
import { space } from 'theme/tokens'
import { px } from 'styles/type'

export const Wrapper = styled.section`
  padding: ${px(space.base)};
  display: flex;
  flex-direction: column;
`

export const ListOfTanks = styled.section`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${px(space.sm)};
`

export const LinkContainer = styled.section`
  padding: ${px(space.lg)} 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${px(space.xs)};
`
