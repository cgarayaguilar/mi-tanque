import { css } from 'styled-components'

// Legacy styled-components bridge to the type scale in 'theme/tokens' (ADR 0001):
// typeStyle(typeScale.bodyMd) renders that token as CSS.
export const typeStyle = token => css`
  font-family: ${token.fontFamily};
  font-size: ${token.fontSize}px;
  font-weight: ${token.fontWeight};
  line-height: ${token.lineHeight};
  letter-spacing: ${token.letterSpacing}px;
  text-transform: ${token.textTransform ?? 'none'};
  font-variant-numeric: ${token.fontVariantNumeric ?? 'normal'};
`

/** Number (px) -> CSS length. */
export const px = value => `${value}px`
