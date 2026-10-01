import styled, { css } from 'styled-components'
import { focusRing } from 'styles/interactive'
import { controlHeight, radius, space, typeScale } from 'theme/tokens'
import { px, typeStyle } from 'styles/type'

// Pill buttons from the design system: 40px, or 48px for the full-width
// primary actions used one-handed at the tank (size="large").
const Primitive = css`
  ${typeStyle(typeScale.button)}
  margin-top: ${({ mt }) => mt ?? 0};
  margin-bottom: ${({ mb }) => mb ?? 0};
  margin-left: ${({ ml }) => ml ?? 0};
  margin-right: ${({ mr }) => mr ?? 0};
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: ${({ size }) =>
    px(size === 'large' ? controlHeight.buttonLarge : controlHeight.button)};
  padding: 0 ${px(space.md)};
  border-radius: ${px(radius.pill)};
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.15s,
    transform 0.15s;

  &:active {
    transform: scale(0.98);
  }

  ${focusRing}

  &:disabled {
    cursor: not-allowed;
    transform: none;
  }
`

export const FilledButton = styled.button`
  ${Primitive}
  background-color: ${({ theme }) => theme.accent};
  color: ${({ theme }) => theme.onAccent};
  border: none;

  &:hover:not(:disabled),
  &:active:not(:disabled) {
    background-color: ${({ theme }) => theme.accentActive};
  }

  &:disabled {
    background-color: ${({ theme }) => theme.cardStrong};
    color: ${({ theme }) => theme.disabledText};
  }
`

export const OutLineButton = styled.button`
  ${Primitive}
  background-color: transparent;
  color: ${({ theme }) => theme.primaryText};
  border: 1px solid ${({ theme }) => theme.controlBorder};

  &:disabled {
    color: ${({ theme }) => theme.disabledText};
  }
`

export const LinkButton = styled.button`
  ${Primitive}
  background-color: transparent;
  color: ${({ theme }) => theme.primaryText};
  border: none;
  text-decoration: underline;
  text-underline-offset: 3px;

  &:disabled {
    color: ${({ theme }) => theme.disabledText};
  }
`
