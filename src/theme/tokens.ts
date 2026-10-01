// Design tokens from DESIGN.md (ElevenLabs-based system adapted to Solo Camioneros):
// the single source for the MUI theme, the legacy styled-components theme and
// the PWA colors. Change DESIGN.md and this file together.

export type ColorMode = 'dark' | 'light'

export interface ColorTokens {
  /** Page floor. */
  canvas: string
  /** Cards, dialogs, inputs. */
  surface: string
  /** Badges, icon plates, gauge track, pressed rows. */
  surfaceStrong: string
  /** Decorative 1px dividers and card outlines. */
  hairline: string
  /** Borders that identify a control (inputs): at least 3:1 (WCAG 1.4.11). */
  controlBorder: string
  /** Display and primary text. */
  ink: string
  /** Default running text. */
  body: string
  /** Secondary text, labels, captions. */
  muted: string
  /** Disabled text and controls. */
  disabled: string
  /** The only action color: ink pill buttons, active states, data graphics. */
  primary: string
  primaryActive: string
  onPrimary: string
  error: string
  success: string
  overlay: string
  /** White for mix-blend-mode: difference, which inverts it against whatever is
   * behind (near-black on light, white on ink): text over the gauge wave. */
  differenceInk: string
  /** Atmospheric orbs only: never fills, text or component backgrounds. */
  gradientMint: string
  gradientSky: string
  gradientLavender: string
}

// Light is the system as designed. Dark is derived from the same warm stone
// scale the system uses for its dark bands. Values that failed WCAG AA as
// interface text or control borders are one step darker (DESIGN.md, Color).
export const colorTokens: Record<ColorMode, ColorTokens> = {
  light: {
    canvas: '#f5f5f5',
    surface: '#ffffff',
    surfaceStrong: '#f0efed',
    hairline: '#e7e5e4',
    controlBorder: '#8f8984',
    ink: '#0c0a09',
    body: '#4e4e4e',
    muted: '#6b655e',
    disabled: '#a8a29e',
    primary: '#292524',
    primaryActive: '#0c0a09',
    onPrimary: '#ffffff',
    error: '#b91c1c',
    success: '#15803d',
    overlay: 'rgba(12, 10, 9, 0.4)',
    differenceInk: '#ffffff',
    gradientMint: '#a7e5d3',
    gradientSky: '#a8c8e8',
    gradientLavender: '#c8b8e0',
  },
  dark: {
    canvas: '#0c0a09',
    surface: '#1c1917',
    surfaceStrong: '#292524',
    hairline: '#292524',
    controlBorder: '#78716c',
    ink: '#ffffff',
    body: '#d6d3d1',
    muted: '#a8a29e',
    disabled: '#57534e',
    primary: '#fafafa',
    primaryActive: '#e7e5e4',
    onPrimary: '#0c0a09',
    error: '#f87171',
    success: '#4ade80',
    overlay: 'rgba(0, 0, 0, 0.6)',
    differenceInk: '#ffffff',
    gradientMint: '#a7e5d3',
    gradientSky: '#a8c8e8',
    gradientLavender: '#c8b8e0',
  },
}

/** The system is light-first. */
export const defaultColorMode: ColorMode = 'light'

export const fontFamily = {
  // Waldenburg is licensed; Newsreader is the open substitute at weight 300
  display: "'Newsreader', 'Times New Roman', serif",
  body: "'Inter', sans-serif",
} as const

export interface TypeStyle {
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  letterSpacing: number
  textTransform?: 'uppercase'
  /** Equal-width digits so figures align and do not jump while they change. */
  fontVariantNumeric?: 'tabular-nums'
}

export const typeScale = {
  displayMd: {
    fontFamily: fontFamily.display,
    fontSize: 32,
    fontWeight: 300,
    lineHeight: 1.13,
    letterSpacing: -0.32,
  },
  displaySm: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    fontWeight: 300,
    lineHeight: 1.2,
    letterSpacing: 0,
  },
  titleMd: {
    fontFamily: fontFamily.body,
    fontSize: 20,
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: 0,
  },
  titleSm: {
    fontFamily: fontFamily.body,
    fontSize: 18,
    fontWeight: 500,
    lineHeight: 1.44,
    letterSpacing: 0.18,
  },
  bodyMd: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0.16,
  },
  bodyStrong: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: 0.16,
  },
  bodySm: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    fontWeight: 400,
    lineHeight: 1.47,
    letterSpacing: 0.15,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
  },
  captionUppercase: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: 0.96,
    textTransform: 'uppercase',
  },
  // Figures (data): Inter 600 with tabular digits. The display serif at 300 is
  // for headings; numbers need weight to be read at a glance next to the tank.
  figureMd: {
    fontFamily: fontFamily.body,
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  figureSm: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.5,
    letterSpacing: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  button: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: 0,
  },
} satisfies Record<string, TypeStyle>

/** px */
export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  pill: 9999,
} as const

/** px; base unit 4 */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  base: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const spacingUnit = 4

/** px */
export const controlHeight = {
  /** Pill buttons, as the system specifies. */
  button: 40,
  /** Project extension: full-width primary actions used one-handed at the tank. */
  buttonLarge: 48,
  input: 44,
} as const

/** px */
export const layout = {
  /** Content column: the app is used one-handed on a phone. */
  maxWidth: 600,
  /** The system's top-nav height. */
  appBarHeight: 64,
  /** Fuel gauge diameter: small enough for the whole reading on one phone screen. */
  gaugeSize: 200,
  /** Room the sticky bottom navigation takes; toasts sit above it. */
  bottomNavSpace: 88,
} as const

/** The system's single shadow tier: hovered cards only. */
export const softShadow = '0 4px 16px rgba(0, 0, 0, 0.04)'

/** Focus ring for keyboard users (§8.11). px */
export const focusRing = { width: 2, offset: 2 } as const
