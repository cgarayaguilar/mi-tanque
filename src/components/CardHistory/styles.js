import styled from 'styled-components'
import { radius, space } from 'theme/tokens'
import { px } from 'styles/type'

export const Wrapper = styled.article`
  background-color: ${({ theme }) => theme.card};
  border: 1px solid ${({ theme }) => theme.hairline};
  border-radius: ${px(radius.lg)};
  padding: ${px(space.base)};
  margin-bottom: ${px(space.xs)};
`

export const Header = styled.header`
  display: grid;
  grid-template-columns: min-content min-content;
  gap: ${px(space.base)};
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${px(space.base)};
`
export const Text = styled.div`
  white-space: nowrap;
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
`
export const Results = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${px(space.xs)};
`

export const BarContainer = styled.div`
  margin-top: ${px(space.base)};
  width: 100%;
  display: grid;
  white-space: nowrap;
  grid-template-columns: min-content 1fr;
  gap: ${px(space.xs)};
  align-items: center;
`

export const Bar = styled.div`
  width: 100%;
  height: ${px(space.xxs)};
  border-radius: ${px(radius.pill)};
  background-color: ${({ theme }) => theme.cardStrong};
  overflow: hidden;
`
export const BarProgress = styled.div`
  width: ${({ width }) => width};
  height: 100%;
  border-radius: ${px(radius.pill)};
  background-color: ${({ theme }) => theme.accent};
`
