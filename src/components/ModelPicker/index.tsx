import { useState, type Ref } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import TankCatalog from 'components/TankCatalog'
import TankThumbnail, { thumbnailFrame } from 'components/TankThumbnail'
import { radius } from 'theme/tokens'
import { formatNumber } from 'utils/formatNumber'
import type { CatalogTank } from 'utils/tankCatalog'
import { TANK_TEMPLATES } from 'utils/tankTemplates'

const MODELS: CatalogTank[] = TANK_TEMPLATES.map(template => ({
  key: template.id,
  capacity: template.capacityGal,
  diameter: template.diameterIn,
  length: template.lengthIn,
}))
const FRAME = thumbnailFrame(MODELS)

interface ModelPickerProps {
  id: string
  /** The chosen template's id, or ''. */
  value: string
  onChange: (templateId: string) => void
  error?: string | undefined
  hint?: string
  disabled?: boolean
  /** The button, so a failed save can focus it (specs/0014 RF-9). */
  buttonRef?: Ref<HTMLButtonElement>
}

/**
 * "Modelo" in the fleet's tank form (backend specs/0014 RF-7–RF-9): a
 * button that opens the catalog in a dialog, full screen on a phone.
 */
export default function ModelPicker({
  id,
  value,
  onChange,
  error,
  hint,
  disabled = false,
  buttonRef,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const chosen = MODELS.find(model => model.key === value)
  const helpId = `${id}-help`
  const help = error ?? hint
  const openCatalog = () => {
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
  }

  return (
    <FormControl fullWidth error={error !== undefined} disabled={disabled}>
      <FormLabel id={`${id}-label`}>Modelo</FormLabel>
      {chosen ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            px: 3,
            py: 2,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: `${String(radius.lg)}px`,
          }}
        >
          <Box sx={{ width: 72, flexShrink: 0 }}>
            <TankThumbnail
              diameter={chosen.diameter}
              length={chosen.length}
              frame={FRAME}
              height={36}
            />
          </Box>
          <Typography variant="subtitle1" component="p" sx={{ flexGrow: 1 }}>
            {formatNumber(chosen.capacity)} gal · Ø{' '}
            {formatNumber(chosen.diameter)} × {formatNumber(chosen.length)}{' '}
            pulg.
          </Typography>
          <Button
            id={id}
            ref={buttonRef}
            variant="outlined"
            size="small"
            disabled={disabled}
            aria-describedby={help === undefined ? undefined : helpId}
            aria-label={`Cambiar modelo: ${formatNumber(chosen.capacity)} galones`}
            onClick={openCatalog}
            sx={{ flexShrink: 0 }}
          >
            Cambiar
          </Button>
        </Box>
      ) : (
        <Button
          id={id}
          ref={buttonRef}
          variant="outlined"
          size="large"
          fullWidth
          disabled={disabled}
          aria-describedby={help === undefined ? undefined : helpId}
          onClick={openCatalog}
        >
          Elegir modelo
        </Button>
      )}
      {help !== undefined && (
        <FormHelperText id={helpId}>{help}</FormHelperText>
      )}

      <Dialog
        open={open}
        onClose={close}
        fullScreen={phone}
        fullWidth
        maxWidth="sm"
        aria-labelledby={`${id}-dialog`}
      >
        <DialogTitle
          id={`${id}-dialog`}
          sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
        >
          <Box component="span" sx={{ flexGrow: 1 }}>
            Elige un modelo
          </Box>
          <IconButton aria-label="Cerrar" onClick={close} edge="end">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TankCatalog
            tanks={MODELS}
            selectedKey={value || null}
            noun="modelo"
            actionLabel="Elegir"
            onChoose={key => {
              onChange(key)
              close()
            }}
          />
        </DialogContent>
      </Dialog>
    </FormControl>
  )
}
