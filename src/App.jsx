import React, { useContext } from 'react'
import { Route } from 'wouter'
import Home from 'pages/Home'
import History from 'pages/History'
import TankSearch from 'pages/TankSearch'
import AddTank from 'pages/AddTank'
import { ThemeProvider } from 'styled-components'
import { AppContext } from 'store'

import { GlobalStyle } from 'styles/globalStyles'
import AppBar from 'components/AppBar'

function App() {
  const { theme } = useContext(AppContext)

  return (
    <div>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <AppBar />
        <Route path="/" default component={Home} />
        <Route path="/tanques" default component={TankSearch} />
        <Route path="/tanques/crear" default component={AddTank} />
        <Route path="/history" component={History} />
      </ThemeProvider>
    </div>
  )
}

export default App
