import styled, { css } from 'styled-components'

const Small = css`
  font-weight: 700;
  font-size: 14px;
`

const Medium = css`
  font-weight: 700;
  font-size: 16px;
`

const Large = css`
  font-weight: 500;
  font-size: 20px;
`

const Primitive = css`
  font-family: 'Roboto', sans-serif;
  font-weight: 500;
  font-size: 20px;
  margin-top: ${({ mt }) => (mt ? mt : 0)};
  margin-bottom: ${({ mb }) => (mb ? mb : 0)};
  margin-left: ${({ ml }) => (ml ? ml : 0)};
  margin-right: ${({ mr }) => (mr ? mr : 0)};

  border-radius: 8px;

  //text-transform: uppercase;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  border: none;
  outline: none;
  padding: 8px;
  height: 48px;
  cursor: pointer;
  transition: all 0.25s;
  position: relative;
  white-space: nowrap;

  &:active {
    transform: scale(0.95);
  }

  &:hover::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    background-color: rgba($color: #000000, $alpha: 0.2);
  }

  //Aplicar estilos segun el tamaño
  ${({ size }) => size === 'small' && `${Small}`}
  ${({ size }) => size === 'medium' && `${Medium}`}
    ${({ size }) => size === 'large' && `${Large}`}
`

export const OutLineButton = styled.button`
  ${Primitive}
  background-color: transparent;
  color: ${({ theme }) => theme.accent};
  border: 1px solid ${({ theme }) => theme.accent};
`
export const LinkButton = styled.button`
  ${Primitive}
  background-color: transparent;
  color: ${({ theme }) => theme.accent};
  border: none;
`
export const FilledButton = styled.button`
  ${Primitive}

  background-color: ${({ theme }) => theme.accent};
  color: #fff;
  border: none;
`
