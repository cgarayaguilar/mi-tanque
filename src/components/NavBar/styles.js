import styled, { css } from 'styled-components'
import { focusRing } from 'styles/interactive'

const ActiveStyles = css`
  //background-color: rgba(0, 168, 204, 0.38);
  color: ${({ theme }) => theme.accent};
`

export const Nav = styled.nav`
  border-radius: 8px;
  margin-top: 32px;
  width: 100%;
  background-color: ${({ theme }) => theme.card};
  color: rgba(0, 0, 0, 0.38);
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
`

export const NavItem = styled.button`
  align-items: center;
  border-radius: 8px;
  border: none;
  color: ${({ theme }) => theme.secondaryText};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font-size: 14px;
  ${focusRing}
  padding: 4px 8px;
  text-align: center;
  background-color: transparent;

  & > span {
    margin-top: 5px;
  }

  ${({ active }) => active && ActiveStyles}
`
