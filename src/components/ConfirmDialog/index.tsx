import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

/** A confirmation before an action the user may not want (§8.8). */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
    >
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-description">
          {description}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
