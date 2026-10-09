import type { MouseEvent, ReactNode } from 'react'
import { useLocation } from 'wouter'
import { useSessionStore } from 'store/session'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import HistoryIcon from '@mui/icons-material/History'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import SpeedIcon from '@mui/icons-material/Speed'
import AltRouteIcon from '@mui/icons-material/AltRoute'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
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

// With a session: its trips (specs/0025 RF-5), its expenses (specs/0026
// RF-8), and "Más" with the fleet's modules and the account (specs/0034)
const SIGNED_IN: Section[] = [
  { href: '/viajes', label: 'Viajes', icon: <AltRouteIcon /> },
  { href: '/gastos', label: 'Gastos', icon: <ReceiptLongIcon /> },
  { href: '/mas', label: 'Más', icon: <MoreHorizIcon /> },
]

// The pages under each section (/viajes/123): "Más" holds the fleet's
// modules and the account (specs/0034 RF-2)
const UNDER: Record<string, readonly string[]> = {
  '/viajes': ['/viajes'],
  '/gastos': ['/gastos'],
  '/mas': ['/mas', '/flota', '/cuenta'],
}

/** Pill tabs between the two main screens; the route decides the active one. */
export default function NavBar() {
  const [location, navigate] = useLocation()
  const signedIn = useSessionStore(state => state.status === 'ready')
  const sections = signedIn ? [...SECTIONS, ...SIGNED_IN] : SECTIONS
  // Four or more do not fit side by side on a phone: icon over its name
  const stacked = sections.length >= 4

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
          gridTemplateColumns: `repeat(${String(sections.length)}, 1fr)`,
          gap: 1,
          p: 1,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: `${String(radius.pill)}px`,
        }}
      >
        {sections.map(({ href, label, icon }) => {
          const under = UNDER[href]
          const active = under
            ? under.some(
                prefix =>
                  location === prefix || location.startsWith(`${prefix}/`)
              )
            : location === href
          return (
            <ButtonBase
              key={href}
              component="a"
              href={href}
              onClick={go(href)}
              aria-current={active ? 'page' : undefined}
              sx={{
                ...(stacked ? typeScale.caption : typeScale.button),
                gap: stacked ? 0.5 : 2,
                flexDirection: stacked ? 'column' : 'row',
                minWidth: 0,
                minHeight: controlHeight.buttonLarge,
                ...(stacked && { py: 1, fontWeight: 500 }),
                borderRadius: `${String(radius.pill)}px`,
                color: active ? 'text.primary' : 'text.secondary',
                bgcolor: theme =>
                  active
                    ? colorTokens[theme.palette.mode].surfaceStrong
                    : 'transparent',
                transition: 'background-color 0.15s, color 0.15s',
                '& svg': { fontSize: 20, display: 'block' },
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
