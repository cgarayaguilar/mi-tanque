import { useState, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { sileo } from 'sileo'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { useSessionStore } from 'store/session'
import { authErrorMessage } from 'utils/authErrors'
import { reportError } from 'utils/reportError'

/**
 * Signing out (specs/0002 RF-14): asks first when there are changes not
 * uploaded yet, then clears the account data and goes back to the basic mode.
 */
export const useSignOut = (): {
  requestSignOut: () => void
  signingOut: boolean
  dialog: ReactNode
} => {
  const signOut = useSessionStore(state => state.signOut)
  const [, navigate] = useLocation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const run = async (discardPending: boolean) => {
    if (signingOut) return
    setSigningOut(true)
    try {
      const result = await signOut({ discardPending })
      if (result === 'pendingWrites') {
        setConfirmOpen(true)
        return
      }
      setConfirmOpen(false)
      sileo.success({ title: 'Cerraste sesión' })
      navigate('/')
    } catch (error) {
      reportError(error, { operation: 'signOut' })
      sileo.error({
        title: 'No pudimos cerrar la sesión',
        description: authErrorMessage(error),
      })
    } finally {
      setSigningOut(false)
    }
  }

  const dialog = (
    <Dialog
      open={confirmOpen}
      onClose={() => {
        setConfirmOpen(false)
      }}
      aria-labelledby="sign-out-title"
      aria-describedby="sign-out-description"
    >
      <DialogTitle id="sign-out-title">Tienes cambios sin subir</DialogTitle>
      <DialogContent>
        <DialogContentText id="sign-out-description">
          Algunos datos todavía no llegan a la nube. Si cierras sesión ahora, se
          perderán. Conéctate a internet y espera unos segundos.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setConfirmOpen(false)
          }}
        >
          Esperar
        </Button>
        <Button
          variant="contained"
          color="error"
          loading={signingOut}
          onClick={() => {
            void run(true)
          }}
        >
          Cerrar sesión igual
        </Button>
      </DialogActions>
    </Dialog>
  )

  return {
    requestSignOut: () => {
      void run(false)
    },
    signingOut,
    dialog,
  }
}
