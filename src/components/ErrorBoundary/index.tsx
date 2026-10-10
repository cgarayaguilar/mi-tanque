import { Component, type ErrorInfo, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { ThemeProvider } from '@mui/material/styles'
import { muiThemes } from 'theme/muiTheme'
import { defaultColorMode, type ColorMode } from 'theme/tokens'
import { reportError } from 'utils/reportError'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

// The fallback renders outside the app providers, so it reads the stored
// light/dark preference itself, or uses the default mode if it cannot.
const storedColorMode = (): ColorMode => {
  try {
    const stored = window.localStorage.getItem('isDarkModeActive')
    if (stored === null) return defaultColorMode
    return stored === 'true' ? 'dark' : 'light'
  } catch {
    return defaultColorMode
  }
}

/** Last line of defense for unexpected render errors (§7.5). */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, {
      operation: 'render',
      componentStack: info.componentStack,
    })
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <ThemeProvider theme={muiThemes[storedColorMode()]}>
        <Box
          component="main"
          role="alert"
          sx={{
            minHeight: '100vh',
            bgcolor: 'background.default',
            color: 'text.primary',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            p: 6,
            textAlign: 'center',
          }}
        >
          <Typography variant="pageTitle">Algo salió mal</Typography>
          <Typography color="text.secondary">
            Recarga la app para seguir. Tus tanques y mediciones guardados no se
            pierden.
          </Typography>
          <Button
            variant="contained"
            onClick={() => {
              window.location.reload()
            }}
          >
            Recargar
          </Button>
        </Box>
      </ThemeProvider>
    )
  }
}
