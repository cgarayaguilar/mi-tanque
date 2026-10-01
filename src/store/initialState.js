import { colorTokens } from 'theme/tokens'

// Legacy styled-components theme: colors per mode, derived from the design
// tokens so it cannot drift from the MUI theme while both exist (ADR 0001).
// Size, type and radius tokens are imported directly from 'theme/tokens'.
const toLegacyTheme = tokens => ({
  background: tokens.canvas,
  card: tokens.surface,
  cardStrong: tokens.surfaceStrong,
  hairline: tokens.hairline,
  controlBorder: tokens.controlBorder,
  accent: tokens.primary,
  accentActive: tokens.primaryActive,
  onAccent: tokens.onPrimary,
  primaryText: tokens.ink,
  bodyText: tokens.body,
  secondaryText: tokens.muted,
  disabledText: tokens.disabled,
  error: tokens.error,
  success: tokens.success,
  gradientMint: tokens.gradientMint,
  gradientSky: tokens.gradientSky,
  gradientLavender: tokens.gradientLavender,
})

export const darkTheme = toLegacyTheme(colorTokens.dark)
export const lightTheme = toLegacyTheme(colorTokens.light)
