import { css } from 'styled-components'

// Legacy styled-components helpers (ADR 0001): they go away when these
// components move to MUI, whose ButtonBase already provides both.

/** Lets a <button> or <a> wrap block content without browser styling. */
export const resetInteractive = css`
  appearance: none;
  border: none;
  background: none;
  padding: 0;
  margin: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
`

/** Visible keyboard focus in the accent color (§8.11). */
export const focusRing = css`
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.accent};
    outline-offset: 2px;
  }
`
