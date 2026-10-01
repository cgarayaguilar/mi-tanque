import type { MouseEvent } from 'react'
import { useLocation } from 'wouter'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LogoIcon from 'assets/logo.svg?react'
import { useColorModeStore } from 'store/colorMode'
import { layout, radius } from 'theme/tokens'

/** top-nav (DESIGN.md): the logo goes home, the button switches light/dark. */
export default function AppBar() {
  const mode = useColorModeStore(state => state.mode)
  const toggle = useColorModeStore(state => state.toggle)
  const [, navigate] = useLocation()

  const goHome = (event: MouseEvent) => {
    event.preventDefault()
    navigate('/')
  }

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: layout.appBarHeight,
        px: 4,
        color: 'text.primary',
      }}
    >
      <ButtonBase
        component="a"
        href="/"
        onClick={goHome}
        aria-label="Solo Camioneros, ir al inicio"
        sx={{ gap: 2, borderRadius: `${String(radius.sm)}px` }}
      >
        <LogoIcon aria-hidden="true" />
        <Typography variant="h3" component="span">
          Solo Camioneros
        </Typography>
      </ButtonBase>

      <IconButton
        size="large"
        color="inherit"
        aria-label={
          mode === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'
        }
        onClick={toggle}
      >
        {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Box>
  )
}
