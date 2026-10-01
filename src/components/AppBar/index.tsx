import type { MouseEvent } from 'react'
import { useLocation } from 'wouter'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LogoIcon from 'assets/logo.svg?react'
import SessionControl from 'components/SessionControl'
import { useColorModeStore } from 'store/colorMode'
import { layout, radius, typeScale } from 'theme/tokens'

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
        sx={{
          gap: 2,
          minWidth: 0,
          borderRadius: `${String(radius.sm)}px`,
          // Phones: a smaller mark so the name stays on one line next to
          // the theme and account buttons (down to 360px wide)
          '& svg': { width: { xs: 52, sm: 70 }, height: 'auto', flexShrink: 0 },
        }}
      >
        <LogoIcon aria-hidden="true" />
        <Typography
          variant="h3"
          component="span"
          noWrap
          sx={{
            fontSize: {
              xs: typeScale.titleSm.fontSize,
              sm: typeScale.displaySm.fontSize,
            },
          }}
        >
          Solo Camioneros
        </Typography>
      </ButtonBase>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
        <SessionControl />
      </Box>
    </Box>
  )
}
