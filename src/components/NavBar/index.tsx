import type { MouseEvent, ReactNode } from 'react'
import { useLocation } from 'wouter'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import HistoryIcon from '@mui/icons-material/History'
import SpeedIcon from '@mui/icons-material/Speed'
import {
  colorTokens,
  controlHeight,
  radius,
  space,
  typeScale,
} from 'theme/tokens'

interface Section {
  href: string
  label: string
  icon: ReactNode
}

const SECTIONS: Section[] = [
  { href: '/history', label: 'Historial', icon: <HistoryIcon /> },
  { href: '/', label: 'Medición', icon: <SpeedIcon /> },
]

/** Pill tabs between the two main screens; the route decides the active one. */
export default function NavBar() {
  const [location, navigate] = useLocation()

  const go = (href: string) => (event: MouseEvent) => {
    // Real links (open in a new tab, copy) that navigate without a reload
    event.preventDefault()
    navigate(href)
  }

  return (
    // Sticky at the bottom of the page, within thumb reach while scrolling
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 1,
        px: 4,
        pt: 2,
        pb: `calc(${String(space.base)}px + env(safe-area-inset-bottom))`,
        bgcolor: 'background.default',
      }}
    >
      <Box
        component="nav"
        aria-label="Secciones"
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
          p: 1,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: `${String(radius.pill)}px`,
        }}
      >
        {SECTIONS.map(({ href, label, icon }) => {
          const active = location === href
          return (
            <ButtonBase
              key={href}
              component="a"
              href={href}
              onClick={go(href)}
              aria-current={active ? 'page' : undefined}
              sx={{
                ...typeScale.button,
                gap: 2,
                minHeight: controlHeight.buttonLarge,
                borderRadius: `${String(radius.pill)}px`,
                color: active ? 'text.primary' : 'text.secondary',
                bgcolor: theme =>
                  active
                    ? colorTokens[theme.palette.mode].surfaceStrong
                    : 'transparent',
                transition: 'background-color 0.15s, color 0.15s',
                '& svg': { fontSize: 20 },
              }}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </ButtonBase>
          )
        })}
      </Box>
    </Box>
  )
}
