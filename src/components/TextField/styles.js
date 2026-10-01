import styled from 'styled-components'
import { controlHeight, radius, space, typeScale } from 'theme/tokens'
import { px, typeStyle } from 'styles/type'

export const Wrapper = styled.div`
  border: none;
  display: flex;
  flex-direction: column;
  margin-top: ${({ mt }) => mt ?? 0};
  margin-bottom: ${({ mb }) => mb ?? 0};
  margin-left: ${({ ml }) => ml ?? 0};
  margin-right: ${({ mr }) => mr ?? 0};
`

export const Label = styled.label`
  ${typeStyle(typeScale.bodyStrong)}
  color: ${({ color, theme }) => color ?? theme.primaryText};
  margin-bottom: ${px(space.xs)};
`

// text-input from the design system: 44px, 1px control border; on focus the
// border thickens to 2px ink (the inset shadow adds the second pixel without
// shifting the layout)
export const TextFieldContainer = styled.fieldset`
  position: relative;
  width: 100%;
  margin: 0;
  background: ${({ theme }) => theme.card};
  border: 1px solid ${({ theme }) => theme.controlBorder};
  border-radius: ${px(radius.md)};
  transition:
    border-color 0.15s,
    box-shadow 0.15s;

  &:focus-within {
    border-color: ${({ theme }) => theme.primaryText};
    box-shadow: inset 0 0 0 1px ${({ theme }) => theme.primaryText};
  }

  input {
    ${typeStyle(typeScale.bodyMd)}
    width: 100%;
    min-height: ${px(controlHeight.input - 2)};
    padding: 0 ${px(space.base)};
    border: none;
    outline: none;
    background-color: transparent;
    color: ${({ theme }) => theme.primaryText};

    &::placeholder {
      color: ${({ theme }) => theme.secondaryText};
      opacity: 1;
    }

    &:focus ~ svg {
      color: ${({ theme }) => theme.primaryText};
    }
  }

  svg {
    position: absolute;
    right: ${px(space.sm)};
    top: 50%;
    transform: translateY(-50%);
    color: ${({ theme }) => theme.secondaryText};
    cursor: pointer;
  }
`
