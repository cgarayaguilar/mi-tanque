import { createTheme, type Theme } from '@mui/material/styles'
import {
  colorTokens,
  fontFamily,
  radius,
  spacingUnit,
  type ColorMode,
} from 'theme/tokens'

// "Mapeo al theme de MUI" in DESIGN.md
const createMuiTheme = (mode: ColorMode): Theme => {
  const color = colorTokens[mode]

  return createTheme({
    palette: {
      mode,
      primary: { main: color.accent, contrastText: color.onAccent },
      background: { default: color.background, paper: color.surface },
      text: { primary: color.textPrimary, secondary: color.textSecondary },
      error: { main: color.error },
    },
    typography: { fontFamily, button: { textTransform: 'none' } },
    spacing: spacingUnit,
    shape: { borderRadius: radius },
    components: {
      // Flat design: hierarchy comes from surface color, not elevation
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiBackdrop: {
        styleOverrides: { root: { backgroundColor: color.overlay } },
      },
    },
  })
}

export const muiThemes: Record<ColorMode, Theme> = {
  dark: createMuiTheme('dark'),
  light: createMuiTheme('light'),
}
