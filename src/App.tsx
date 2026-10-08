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
// Trips (backend specs/0025)
const Trips = lazy(() => import('pages/Trips'))
const Trip = lazy(() => import('pages/Trip'))
const TripEditor = lazy(() => import('pages/TripEditor'))
// An invitation link (specs/0005)
const Invitation = lazy(() => import('pages/Invitation'))
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
          // The text of components/RecaptchaNotice replaces Google's badge,
          // which would cover the bottom navigation (specs/0008 RF-12)
          '.grecaptcha-badge': { visibility: 'hidden' },
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
        <Route path="/viajes" component={Trips} />
        {/* One route: without a Switch, /viajes/nuevo would match both */}
        <Route path="/viajes/:id">
          {(params: { id: string }) =>
            params.id === 'nuevo' ? <TripEditor /> : <Trip />
          }
        </Route>
        <Route path="/viajes/:id/editar" component={TripEditor} />
        <Route path="/invitacion/:token" component={Invitation} />
      </Suspense>
      {/* Its own boundary: loading its chunk must not blank the page */}
      {sessionStatus === 'ready' && (
        <Suspense fallback={null}>
          <ImportOffer />
        </Suspense>
      )}
      {/* Single toast outlet for mutation feedback (§8.14). Every toast goes
          to the top center (owner's directive); calls never pass a position */}
      <Toaster position="top-center" theme={mode} />
    </ThemeProvider>
  )
}
