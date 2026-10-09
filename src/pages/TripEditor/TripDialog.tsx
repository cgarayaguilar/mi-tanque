import { useState } from 'react'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import ConfirmDialog from 'components/ConfirmDialog'
import type { Currency } from 'schemas/account'
import type { Trip, TripFormValues } from 'schemas/trips'
// Only lazy pages open it: the SDK stays out of the basic mode
import { newTripId } from 'services/trips'
import TripForm from './TripForm'

interface TripDialogProps {
  orgId: string
  currency: Currency
  /** The truck or trailer of a refuel, already chosen. */
  preset?: Partial<Pick<TripFormValues, 'truckId' | 'trailerId'>>
  onSaved: (trip: Trip) => void
  onClose: () => void
}

/**
 * "+ Crear viaje" (backend specs/0031 RF-3): the trip's whole form, full
 * screen, over the expense that is being written.
 */
export default function TripDialog({
  orgId,
  currency,
  preset,
  onSaved,
  onClose,
}: TripDialogProps) {
  // Its id exists from the moment it opens (ADR 0003)
  const [id] = useState(newTripId)
  const [dirty, setDirty] = useState(false)
  const [asking, setAsking] = useState(false)
  const close = () => {
    if (dirty) setAsking(true)
    else onClose()
  }

  return (
    <Dialog open fullScreen onClose={close} aria-labelledby="trip-dialog-title">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2,
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <IconButton aria-label="Cerrar" onClick={close}>
          <CloseIcon />
        </IconButton>
        <Typography id="trip-dialog-title" variant="h6" component="h2">
          Nuevo viaje
        </Typography>
      </Box>
      <DialogContent
        sx={{ px: 4, pt: 4, pb: 0 }}
        // Events go up through the portal: the expense's form must not
        // receive the trip's submit
        onSubmit={event => {
          event.stopPropagation()
        }}
      >
        <TripForm
          trip={null}
          expenses={[]}
          id={id}
          orgId={orgId}
          currency={currency}
          {...(preset && { preset })}
          onSaved={trip => {
            onSaved(trip)
            onClose()
          }}
          onDirtyChange={setDirty}
        />
      </DialogContent>
      <ConfirmDialog
        open={asking}
        title="¿Descartar el viaje?"
        description="Lo que escribiste no se guarda."
        confirmLabel="Descartar"
        onConfirm={onClose}
        onClose={() => {
          setAsking(false)
        }}
      />
    </Dialog>
  )
}
