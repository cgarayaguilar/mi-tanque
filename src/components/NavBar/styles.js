import styled, { css } from 'styled-components'
import { focusRing } from 'styles/interactive'
import { controlHeight, radius, space, typeScale } from 'theme/tokens'
import { px, typeStyle } from 'styles/type'

const ActiveStyles = css`
  color: ${({ theme }) => theme.primaryText};
  background-color: ${({ theme }) => theme.cardStrong};
`

export const Nav = styled.nav`
  width: 100%;
  margin-top: ${px(space.xl)};
  padding: ${px(space.xxs)};
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${px(space.xxs)};
  align-items: center;
  background-color: ${({ theme }) => theme.card};
  border: 1px solid ${({ theme }) => theme.hairline};
  border-radius: ${px(radius.pill)};
`

export const NavItem = styled.button`
  ${typeStyle(typeScale.button)}
  ${focusRing}
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: ${px(space.xs)};
  min-height: ${px(controlHeight.buttonLarge)};
  padding: 0 ${px(space.base)};
  border: none;
  border-radius: ${px(radius.pill)};
  background-color: transparent;
  color: ${({ theme }) => theme.secondaryText};
  cursor: pointer;

  ${({ active }) => active && ActiveStyles}
`
