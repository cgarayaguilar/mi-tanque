import type { BaseSyntheticEvent, ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'

interface CreateDialogProps {
  /** "Nuevo conductor". */
  title: string
  formId: string
  /** "Guardar conductor". */
  saveLabel: string
  onSubmit: (event: BaseSyntheticEvent) => void
  onClose: () => void
  children: ReactNode
}

/**
 * The frame of a "+ Crear …" dialog (backend specs/0028 RF-2): its own form
 * inside the trip's or the expense's, which is not submitted with it.
 */
export default function CreateDialog({
  title,
  formId,
  saveLabel,
  onSubmit,
  onClose,
  children,
}: CreateDialogProps) {
  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby={`${formId}-title`}
      fullWidth
      scroll="paper"
    >
      <DialogTitle id={`${formId}-title`}>{title}</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          id={formId}
          noValidate
          aria-label={title}
          onSubmit={event => {
            // Events go up through the portal: the form behind must not
            // receive this submit
            event.stopPropagation()
            onSubmit(event)
          }}
          sx={{ pt: 2 }}
        >
          {children}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" form={formId} variant="contained">
          {saveLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
