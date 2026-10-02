import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import StraightenIcon from '@mui/icons-material/Straighten'
import TankPreview from 'components/TankPreview'
import { measureSteps } from 'utils/measureHelp'
import type { TankOrientation, TankShape } from 'utils/tankVolume'

interface MeasureGuideProps {
  shape: TankShape
  orientation: TankOrientation
}

/**
 * "¿Cómo medir mi tanque?" (backend specs/0013 RF-5): a link that opens the
 * drawing of the chosen shape with each measure named, and the steps.
 */
export default function MeasureGuide({
  shape,
  orientation,
}: MeasureGuideProps) {
  const [open, setOpen] = useState(false)
  const close = () => {
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="text"
        startIcon={<StraightenIcon />}
        onClick={() => {
          setOpen(true)
        }}
        sx={{ alignSelf: 'flex-start', px: 0 }}
      >
        ¿Cómo medir mi tanque?
      </Button>
      <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
        <DialogTitle>Cómo medir tu tanque</DialogTitle>
        <DialogContent>
          <TankPreview
            shape={shape}
            orientation={orientation}
            length={null}
            labels="names"
          />
          <Box component="ol" sx={{ pl: 5, mt: 4, mb: 0 }}>
            {measureSteps(shape, orientation).map(step => (
              <Typography
                key={step}
                component="li"
                variant="body2"
                sx={{ mb: 2 }}
              >
                {step}
              </Typography>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={close}>
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
