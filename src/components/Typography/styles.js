import styled, { css } from 'styled-components'
import { typeScale } from 'theme/tokens'
import { typeStyle } from 'styles/type'

const Primitive = css`
  margin-top: ${({ mt }) => mt ?? 0};
  margin-bottom: ${({ mb }) => mb ?? 0};
  margin-left: ${({ ml }) => ml ?? 0};
  margin-right: ${({ mr }) => mr ?? 0};
`

/** Gauge figure: display-md, the editorial serif at weight 300. */
export const Display = styled.span`
  ${Primitive}
  ${typeStyle(typeScale.displayMd)}
  display: block;
  color: ${({ color, theme }) => color ?? theme.primaryText};
`

/** App wordmark: display-sm. */
export const Title = styled.h1`
  ${Primitive}
  ${typeStyle(typeScale.displaySm)}
  color: ${({ color, theme }) => color ?? theme.primaryText};
`

/** Section heads: display-sm. */
export const Title2 = styled.h2`
  ${Primitive}
  ${typeStyle(typeScale.displaySm)}
  color: ${({ color, theme }) => color ?? theme.primaryText};
`

/** Card and list titles: title-sm. */
export const Title3 = styled.h3`
  ${Primitive}
  ${typeStyle(typeScale.titleSm)}
  color: ${({ color, theme }) => color ?? theme.primaryText};
`

/** Tertiary text link look (visual only; interactive elements are buttons or links). */
export const Link = styled.span`
  ${Primitive}
  ${typeStyle(typeScale.button)}
  display: block;
  color: ${({ color, theme }) => color ?? theme.primaryText};
  text-decoration: underline;
  text-underline-offset: 3px;
`

export const Link2 = styled(Link)`
  ${typeStyle(typeScale.caption)}
  font-weight: ${typeScale.bodyStrong.fontWeight};
`

export const Body = styled.p`
  ${Primitive}
  ${typeStyle(typeScale.bodySm)}
  color: ${({ color, theme }) => color ?? theme.bodyText};
`

export const Caption = styled.span`
  ${Primitive}
  ${typeStyle(typeScale.caption)}
  display: block;
  color: ${({ color, theme }) => color ?? theme.secondaryText};
`

/** Labels: caption-uppercase. */
export const Caption2 = styled.span`
  ${Primitive}
  ${typeStyle(typeScale.captionUppercase)}
  display: block;
  color: ${({ color, theme }) => color ?? theme.secondaryText};
`
