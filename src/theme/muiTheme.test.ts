import { muiThemes } from 'theme/muiTheme'
import { typeScale } from 'theme/tokens'

// backend specs/0038 RF-3: a screen's title is its h1, bold, in both modes
test.each(['light', 'dark'] as const)(
  'the title of a screen is a bold h1 (%s)',
  mode => {
    const theme = muiThemes[mode]
    expect(theme.typography.pageTitle).toMatchObject({
      fontFamily: typeScale.displaySm.fontFamily,
      fontSize: typeScale.displaySm.fontSize,
      fontWeight: 600,
    })
    expect(
      theme.components?.MuiTypography?.defaultProps?.variantMapping
    ).toMatchObject({ pageTitle: 'h1' })
  }
)
