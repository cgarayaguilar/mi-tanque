// Design tokens from DESIGN.md: the single source for both the MUI theme and
// the legacy styled-components theme. Change DESIGN.md and this file together.

export type ColorMode = 'dark' | 'light'

export interface ColorTokens {
  background: string
  surface: string
  accent: string
  onAccent: string
  textPrimary: string
  textSecondary: string
  error: string
  overlay: string
}

export const colorTokens: Record<ColorMode, ColorTokens> = {
  dark: {
    background: '#142850',
    surface: '#27496D',
    accent: '#00A8CC',
    onAccent: '#FFFFFF',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.57)',
    error: '#B00020',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  light: {
    background: '#FFFFFF',
    surface: '#E1E1E1',
    accent: '#00A8CC',
    onAccent: '#FFFFFF',
    textPrimary: '#142850',
    textSecondary: 'rgba(39, 73, 109, 0.54)',
    error: '#B00020',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
}

export const fontFamily = "'Roboto', sans-serif"
/** Base spacing unit in px: theme.spacing(1). */
export const spacingUnit = 8
/** Corner radius in px for cards, fields, buttons and dialogs. */
export const radius = 8
