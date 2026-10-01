import styled from 'styled-components'
import { layout, space } from 'theme/tokens'
import { px } from 'styles/type'

export const Container = styled.section`
  min-height: calc(100vh - ${px(layout.appBarHeight)});
  display: flex;
  flex-direction: column;
`

export const NavBarContainer = styled.div`
  width: 100%;
  margin-top: auto;
  padding: 0 ${px(space.base)} ${px(space.base)};
`

export const Wrapper = styled.section`
  max-width: 100%;
  padding: ${px(space.base)};
`
export const Results = styled.section`
  padding: ${px(space.base)} 0;
  display: flex;
  justify-content: space-between;
`
