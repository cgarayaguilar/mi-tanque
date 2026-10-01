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
      subtitle1: typeScale.titleSm,
      subtitle2: typeScale.bodyStrong,
      body1: { ...typeScale.bodyMd, color: color.body },
      body2: { ...typeScale.bodySm, color: color.body },
      caption: typeScale.caption,
      overline: typeScale.captionUppercase,
      button: { ...typeScale.button, textTransform: 'none' },
    },
    components: {
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
      MuiInputAdornment: {
        styleOverrides: { root: { color: color.muted } },
      },
      MuiStepLabel: {
        styleOverrides: {
          label: {
            ...typeScale.titleSm,
            color: color.ink,
            '&.Mui-active, &.Mui-completed': {
              color: color.ink,
              fontWeight: typeScale.titleSm.fontWeight,
            },
          },
        },
      },
      MuiStepIcon: {
        styleOverrides: {
          root: {
            color: color.surfaceStrong,
            '& .MuiStepIcon-text': {
              fill: color.muted,
              ...typeScale.captionUppercase,
            },
            '&.Mui-active, &.Mui-completed': { color: color.primary },
            '&.Mui-active .MuiStepIcon-text': { fill: color.onPrimary },
          },
        },
      },
      MuiStepConnector: {
        styleOverrides: { line: { borderColor: color.hairline } },
      },
      MuiStepContent: {
        styleOverrides: { root: { borderColor: color.hairline } },
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
