import { useId, useState, type MouseEvent } from 'react'
import { useLocation } from 'wouter'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import { useSignOut } from 'hooks/useSignOut'
import { useSessionStore } from 'store/session'
import { typeScale } from 'theme/tokens'

const AVATAR_SIZE = 32

const initialOf = (name: string | null | undefined) =>
  name?.trim().charAt(0).toUpperCase() ?? ''

/** "Entrar" without a session; the user's avatar and menu with one (RF-1, RF-6). */
export default function SessionControl() {
  const status = useSessionStore(state => state.status)
  const name = useSessionStore(
    state => state.profile?.displayName ?? state.user?.displayName ?? null
  )
  const [, navigate] = useLocation()
  const { requestSignOut, dialog } = useSignOut()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const menuId = useId()

  if (status === 'signedOut') {
    return (
      <Button
        onClick={() => {
          navigate('/entrar')
        }}
      >
        Entrar
      </Button>
    )
  }

  if (status === 'loading' && name === null) {
    return (
      <Skeleton
        variant="circular"
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        aria-label="Cargando tu cuenta"
        sx={{ mx: 2 }}
      />
    )
  }

  const close = () => {
    setAnchor(null)
  }
  const accountPath = status === 'needsOnboarding' ? '/bienvenida' : '/cuenta'

  return (
    <>
      <IconButton
        aria-label={name ? `Tu cuenta: ${name}` : 'Tu cuenta'}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        aria-controls={anchor ? menuId : undefined}
        onClick={(event: MouseEvent<HTMLElement>) => {
          setAnchor(event.currentTarget)
        }}
      >
        <Avatar
          sx={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            ...typeScale.bodyStrong,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          {initialOf(name) || <PersonOutlinedIcon fontSize="small" />}
        </Avatar>
      </IconButton>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            close()
            navigate(accountPath)
          }}
        >
          <ListItemIcon>
            <PersonOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Mi cuenta
        </MenuItem>
        <MenuItem
          onClick={() => {
            close()
            requestSignOut()
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Cerrar sesión
        </MenuItem>
      </Menu>
      {dialog}
    </>
  )
}
