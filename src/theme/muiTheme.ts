import { createTheme, type Theme } from '@mui/material/styles'
import {
  colorTokens,
  controlHeight,
  focusRing,
  fontFamily,
  radius,
  space,
  spacingUnit,
  typeScale,
  type ColorMode,
} from 'theme/tokens'

declare module '@mui/material/styles' {
  interface TypographyVariants {
    pageTitle: React.CSSProperties
  }
  interface TypographyVariantsOptions {
    pageTitle?: React.CSSProperties
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    pageTitle: true
  }
}

// "Mapeo al theme de MUI" in DESIGN.md
const createMuiTheme = (mode: ColorMode): Theme => {
  const color = colorTokens[mode]

  return createTheme({
    palette: {
      mode,
      primary: {
        main: color.primary,
        dark: color.primaryActive,
        contrastText: color.onPrimary,
      },
      background: { default: color.canvas, paper: color.surface },
      text: {
        primary: color.ink,
        secondary: color.muted,
        disabled: color.disabled,
      },
      divider: color.hairline,
      error: { main: color.error },
      success: { main: color.success },
    },
    spacing: spacingUnit,
    shape: { borderRadius: radius.md },
    typography: {
      fontFamily: fontFamily.body,
      h1: typeScale.displayMd,
      h2: typeScale.displayMd,
      h3: typeScale.displaySm,
      h4: typeScale.displaySm,
      h5: typeScale.displaySm,
      h6: typeScale.titleMd,
      pageTitle: typeScale.pageTitle,
      subtitle1: typeScale.titleSm,
      subtitle2: typeScale.bodyStrong,
      body1: { ...typeScale.bodyMd, color: color.body },
      body2: { ...typeScale.bodySm, color: color.body },
      caption: typeScale.caption,
      overline: typeScale.captionUppercase,
      button: { ...typeScale.button, textTransform: 'none' },
    },
    components: {
      // A screen's title is its h1 (specs/0038 RF-3)
      MuiTypography: {
        defaultProps: { variantMapping: { pageTitle: 'h1' } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: radius.pill,
            minHeight: controlHeight.button,
            paddingInline: space.md,
          },
          sizeLarge: { minHeight: controlHeight.buttonLarge },
          contained: {
            '&:hover': { backgroundColor: color.primaryActive },
          },
          outlined: {
            color: color.ink,
            borderColor: color.controlBorder,
          },
          text: { color: color.ink },
        },
      },
      MuiButtonBase: {
        styleOverrides: {
          root: {
            '&.Mui-focusVisible': {
              outline: `${String(focusRing.width)}px solid ${color.primary}`,
              outlineOffset: focusRing.offset,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: radius.xl,
            border: `1px solid ${color.hairline}`,
          },
          paperFullScreen: { borderRadius: 0, border: 'none' },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { ...typeScale.displaySm, color: color.ink } },
      },
      MuiBackdrop: {
        styleOverrides: { root: { backgroundColor: color.overlay } },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: {
            ...typeScale.bodyStrong,
            color: color.ink,
            marginBottom: space.xs,
            '&.Mui-focused': { color: color.ink },
            '&.Mui-error': { color: color.ink },
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            ...typeScale.caption,
            marginInline: 0,
            color: color.muted,
            '&.Mui-error': { color: color.error },
          },
        },
      },
      // Buttons side by side for 2–3 choices (specs/0009 RF-1)
      MuiToggleButton: {
        styleOverrides: {
          root: {
            ...typeScale.button,
            textTransform: 'none',
            minHeight: controlHeight.input,
            color: color.body,
            borderColor: color.controlBorder,
            '&.Mui-selected, &.Mui-selected:hover': {
              backgroundColor: color.primary,
              color: color.onPrimary,
            },
          },
        },
      },
      // Material menus instead of the system picker (specs/0009 RF-1)
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${color.hairline}`,
            borderRadius: radius.md,
            marginTop: space.xxs,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { ...typeScale.bodyMd, minHeight: controlHeight.input },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            border: `1px solid ${color.hairline}`,
            borderRadius: radius.md,
            marginTop: space.xxs,
          },
          option: { ...typeScale.bodyMd, minHeight: controlHeight.input },
          noOptions: typeScale.bodySm,
          // The field keeps the 44px of the other inputs
          inputRoot: {
            '&.MuiOutlinedInput-root': { padding: 0, paddingRight: 56 },
            '&.MuiOutlinedInput-root .MuiAutocomplete-input': {
              padding: `${String((controlHeight.input - typeScale.bodyMd.fontSize * 1.4375) / 2)}px ${String(space.base)}px`,
            },
          },
        },
      },
      MuiInputAdornment: {
        styleOverrides: { root: { color: color.muted } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          input: {
            // MUI's input line box is 1.4375em; the padding completes the 44px control
            ...typeScale.bodyMd,
            padding: `${String((controlHeight.input - typeScale.bodyMd.fontSize * 1.4375) / 2)}px ${String(space.base)}px`,
          },
          root: {
            borderRadius: radius.md,
            backgroundColor: color.surface,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: color.controlBorder,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: color.ink,
              borderWidth: 2,
            },
            // After the focus rule so an invalid field stays red while focused
            '&.Mui-error .MuiOutlinedInput-notchedOutline': {
              borderColor: color.error,
            },
          },
        },
      },
    },
  })
}

export const muiThemes: Record<ColorMode, Theme> = {
  dark: createMuiTheme('dark'),
  light: createMuiTheme('light'),
}
