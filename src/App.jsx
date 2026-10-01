import { useContext, useEffect } from 'react'
import { Route } from 'wouter'
import Home from 'pages/Home'
import History from 'pages/History'
import TankSearch from 'pages/TankSearch'
import AddTank from 'pages/AddTank'
import { ThemeProvider } from 'styled-components'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { muiThemes } from 'theme/muiTheme'
import { Toaster } from 'sileo'
import { AppContext } from 'store'

import { GlobalStyle } from 'styles/globalStyles'
import AppBar from 'components/AppBar'

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
        <Route path="/" default component={Home} />
        <Route path="/tanques" default component={TankSearch} />
        <Route path="/tanques/crear" default component={AddTank} />
        <Route path="/history" component={History} />
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
