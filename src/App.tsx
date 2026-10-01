import { lazy, Suspense, useEffect } from 'react'
import { Route } from 'wouter'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import { ThemeProvider } from '@mui/material/styles'
import { Toaster } from 'sileo'
import AppBar from 'components/AppBar'
import Home from 'pages/Home'
import { useColorModeStore } from 'store/colorMode'
import { useSessionStore } from 'store/session'
import { muiThemes } from 'theme/muiTheme'
import { colorTokens, layout } from 'theme/tokens'

// Home is the landing screen; the rest load on first visit. The
// service worker precaches every chunk, so they still open offline.
const TankSearch = lazy(() => import('pages/TankSearch'))
const AddTank = lazy(() => import('pages/AddTank'))
const History = lazy(() => import('pages/History'))
// Signed-in mode (specs/0002): their chunks carry the Firebase SDK
const SignIn = lazy(() => import('pages/SignIn'))
const Welcome = lazy(() => import('pages/Welcome'))
const Account = lazy(() => import('pages/Account'))
const Fleet = lazy(() => import('pages/Fleet'))
const FleetItem = lazy(() => import('pages/FleetItem'))
// Offers the basic mode's data once per organization (specs/0004 RF-15)
const ImportOffer = lazy(() => import('components/ImportOffer'))

export default function App() {
  const mode = useColorModeStore(state => state.mode)
  const color = colorTokens[mode]
  const sessionStatus = useSessionStore(state => state.status)
  const startSession = useSessionStore(state => state.start)

  // Restore a remembered session; without one the SDK is never loaded
  useEffect(() => {
    if (sessionStatus === 'loading') void startSession()
  }, [sessionStatus, startSession])

  // Keep the mobile status bar (installed PWA) in sync with light/dark mode
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', color.canvas)
  }, [color.canvas])

  return (
    <ThemeProvider theme={muiThemes[mode]}>
      {/* Reset, canvas background and body type from the theme */}
      <CssBaseline />
      <GlobalStyles
        styles={{
          body: {
            maxWidth: layout.maxWidth,
            margin: '0 auto',
            color: color.body,
          },
          // Sileo title-cases toast titles; Spanish uses sentence case (§9)
          '[data-sileo-viewport] [data-sileo-title]': {
            textTransform: 'none',
          },
          // Sileo's description on its light toast is 3.95:1; 0.7 gives
          // 8.6:1 (WCAG AA, §8.11)
          "[data-sileo-viewport][data-theme='dark'] [data-sileo-description]": {
            color: 'rgba(0, 0, 0, 0.7)',
          },
        }}
      />
      <AppBar />
      <Suspense fallback={null}>
        <Route path="/" component={Home} />
        <Route path="/tanques" component={TankSearch} />
        <Route path="/tanques/crear" component={AddTank} />
        <Route path="/history" component={History} />
        <Route path="/entrar" component={SignIn} />
        <Route path="/bienvenida" component={Welcome} />
        <Route path="/cuenta" component={Account} />
        <Route path="/flota" component={Fleet} />
        <Route path="/flota/:section" component={Fleet} />
        <Route path="/flota/:section/:id" component={FleetItem} />
        {sessionStatus === 'ready' && <ImportOffer />}
      </Suspense>
      {/* Single toast outlet for mutation feedback (§8.14) */}
      <Toaster
        position="bottom-center"
        offset={{ bottom: layout.bottomNavSpace }}
        theme={mode}
      />
    </ThemeProvider>
  )
}
