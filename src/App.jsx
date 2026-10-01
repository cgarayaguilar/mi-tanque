import { lazy, Suspense, useContext, useEffect } from 'react'
import { Route } from 'wouter'
import Home from 'pages/Home'
import { ThemeProvider } from 'styled-components'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { muiThemes } from 'theme/muiTheme'
import { Toaster } from 'sileo'
import { AppContext } from 'store'

import { GlobalStyle } from 'styles/globalStyles'
import AppBar from 'components/AppBar'

// Home is the landing screen; the rest load on first visit. The
// service worker precaches every chunk, so they still open offline.
const TankSearch = lazy(() => import('pages/TankSearch'))
const AddTank = lazy(() => import('pages/AddTank'))
const History = lazy(() => import('pages/History'))

function App() {
  const { theme, isDarkModeActive } = useContext(AppContext)

  // Keep the mobile status bar (installed PWA) in sync with light/dark mode
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme.background)
  }, [theme.background])

  return (
    <MuiThemeProvider theme={muiThemes[isDarkModeActive ? 'dark' : 'light']}>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <AppBar />
        <Suspense fallback={null}>
          <Route path="/" component={Home} />
          <Route path="/tanques" component={TankSearch} />
          <Route path="/tanques/crear" component={AddTank} />
          <Route path="/history" component={History} />
        </Suspense>
      </ThemeProvider>
      {/* Single toast outlet for mutation feedback (§8.14) */}
      <Toaster
        position="bottom-center"
        theme={isDarkModeActive ? 'dark' : 'light'}
      />
    </MuiThemeProvider>
  )
}

export default App
