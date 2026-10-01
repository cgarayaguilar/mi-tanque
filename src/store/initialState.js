import { colorTokens } from 'theme/tokens'

// Legacy styled-components theme, derived from the design tokens so it cannot
// drift from the MUI theme while both exist (ADR 0001, phase 3)
const toLegacyTheme = tokens => ({
  background: tokens.background,
  card: tokens.surface,
  accent: tokens.accent,
  onAccent: tokens.onAccent,
  primaryText: tokens.textPrimary,
  secondaryText: tokens.textSecondary,
  error: tokens.error,
})

export const darkTheme = toLegacyTheme(colorTokens.dark)
export const lightTheme = toLegacyTheme(colorTokens.light)
