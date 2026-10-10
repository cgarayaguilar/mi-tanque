import { useEffect, useMemo, type MouseEvent, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined'
import RvHookupOutlinedIcon from '@mui/icons-material/RvHookupOutlined'
import NavBar from 'components/NavBar'
import SessionGate from 'components/SessionGate'
import { useExpensesStore } from 'store/expenses'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import { layout, radius } from 'theme/tokens'
import { moreGroups, type MoreRowKey } from 'utils/moreSections'

const ICONS: Record<MoreRowKey, ReactNode> = {
  camiones: <LocalShippingOutlinedIcon />,
  remolques: <RvHookupOutlinedIcon />,
  tanques: <LocalGasStationOutlinedIcon />,
  conductores: <BadgeOutlinedIcon />,
  clientes: <BusinessOutlinedIcon />,
  tarifas: <RequestQuoteOutlinedIcon />,
  categorias: <CategoryOutlinedIcon />,
  cuenta: <AccountCircleOutlinedIcon />,
}

/** "Más" (backend specs/0034): every module, as a settings list. */
function MoreScreen() {
  const [, navigate] = useLocation()
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const organization = useSessionStore(
    state => state.organization?.name ?? null
  )
  // As the account menu says it: the profile's, else the sign-in's
  const person = useSessionStore(
    state => state.profile?.displayName ?? state.user?.displayName ?? null
  )
  const fleet = useFleetStore()
  const loadFleet = fleet.load
  const categories = useExpensesStore(state => state.categories)
  const categoriesStatus = useExpensesStore(state => state.categoriesStatus)
  const loadCategories = useExpensesStore(state => state.loadCategories)

  useEffect(() => {
    if (!orgId) return
    void loadFleet(orgId)
    void loadCategories(orgId)
  }, [orgId, loadFleet, loadCategories])

  const groups = useMemo(
    () =>
      moreGroups(
        {
          fleet: fleet.status === 'ready' ? fleet : null,
          categories:
            categoriesStatus === 'ready'
              ? categories.filter(category => !category.archived).length
              : null,
          person,
          organization,
        },
        new Date()
      ),
    [fleet, categories, categoriesStatus, person, organization]
  )
  const loading = (line: string | null) =>
    line === null &&
    (fleet.status === 'loading' ||
      fleet.status === 'idle' ||
      categoriesStatus === 'loading')

  // Real links (open in a new tab) that navigate without a reload
  const go = (href: string) => (event: MouseEvent) => {
    event.preventDefault()
    navigate(href)
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: `calc(100dvh - ${String(layout.appBarHeight)}px)`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ px: 4, pt: 2, pb: 4, flexGrow: 1 }}>
        <Typography variant="pageTitle" sx={{ mb: 5 }}>
          Más
        </Typography>
        {groups.map(group => (
          <Box
            key={group.title}
            component="section"
            aria-labelledby={`more-${group.title}`}
            sx={{ mb: 5 }}
          >
            <Typography
              id={`more-${group.title}`}
              variant="overline"
              component="h2"
              sx={{ display: 'block', color: 'text.secondary', mb: 1 }}
            >
              {group.title}
            </Typography>
            <Box
              component="ul"
              aria-label={group.title}
              sx={{
                listStyle: 'none',
                m: 0,
                p: 0,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: `${String(radius.lg)}px`,
                overflow: 'hidden',
              }}
            >
              {group.rows.map((row, index) => (
                <Box
                  component="li"
                  key={row.key}
                  sx={{
                    ...(index > 0 && { borderTop: 1, borderColor: 'divider' }),
                  }}
                >
                  <ButtonBase
                    component="a"
                    href={row.href}
                    onClick={go(row.href)}
                    aria-label={
                      row.line ? `${row.label}, ${row.line}` : row.label
                    }
                    sx={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      px: 4,
                      py: 3,
                      textAlign: 'left',
                      color: 'text.primary',
                    }}
                  >
                    <Box
                      component="span"
                      sx={{ display: 'flex', color: 'text.secondary' }}
                    >
                      {ICONS[row.key]}
                    </Box>
                    <Box
                      component="span"
                      sx={{ flexGrow: 1, minWidth: 0, display: 'block' }}
                    >
                      <Typography
                        component="span"
                        variant="subtitle1"
                        sx={{ display: 'block' }}
                      >
                        {row.label}
                      </Typography>
                      {row.line ? (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{
                            display: 'block',
                            color: 'text.secondary',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {row.line}
                        </Typography>
                      ) : (
                        loading(row.line) && (
                          <Skeleton variant="text" width="50%" />
                        )
                      )}
                    </Box>
                    <ChevronRightIcon sx={{ color: 'text.secondary' }} />
                  </ButtonBase>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
      <NavBar />
    </Box>
  )
}

export default function More() {
  return (
    <SessionGate needs="ready">
      <MoreScreen />
    </SessionGate>
  )
}
