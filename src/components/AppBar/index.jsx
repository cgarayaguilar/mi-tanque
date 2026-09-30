import React, { useContext } from 'react'
import { useLocation } from 'wouter'
//Import icons
import LogoIcon from 'assets/logo.svg?react'
import { FaSun as LightModeIcon } from 'react-icons/fa'
import { FaMoon as DarkModeIcon } from 'react-icons/fa'

import { AppContext } from 'store'

//Import components
import Typography from 'components/Typography'
import { Header, Logo } from './styles'

export default function AppBar() {
  const [_, setLocation] = useLocation()

  const { isDarkModeActive, disableDarkMode, activateDarkMode } = useContext(
    AppContext
  )

  const goToHome = () => setLocation('/')

  return (
    <Header>
      <Logo onClick={goToHome}>
        <LogoIcon />
        <Typography ml="8px" variant="title" value="Mi tanque" />
      </Logo>

      {isDarkModeActive ? (
        <LightModeIcon
          onClick={disableDarkMode}
          size={30}
          color={isDarkModeActive ? '#fff' : '#142850'}
        />
      ) : (
        <DarkModeIcon
          onClick={activateDarkMode}
          size={30}
          color={isDarkModeActive ? '#fff' : '#142850'}
        />
      )}
    </Header>
  )
}
