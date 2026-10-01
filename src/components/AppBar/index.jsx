import { useContext } from 'react'
import { Link } from 'wouter'
import IconButton from '@mui/material/IconButton'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LogoIcon from 'assets/logo.svg?react'
import { AppContext } from 'store'
import Typography from 'components/Typography'
import { Header, Logo } from './styles'

export default function AppBar() {
  const { isDarkModeActive, disableDarkMode, activateDarkMode } =
    useContext(AppContext)

  return (
    <Header>
      <Link href="/">
        <Logo aria-label="Mi tanque, ir al inicio">
          <LogoIcon aria-hidden="true" />
          <Typography variant="title" value="Mi tanque" />
        </Logo>
      </Link>

      <IconButton
        size="large"
        color="inherit"
        aria-label={
          isDarkModeActive ? 'Activar modo claro' : 'Activar modo oscuro'
        }
        onClick={isDarkModeActive ? disableDarkMode : activateDarkMode}
      >
        {isDarkModeActive ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Header>
  )
}
