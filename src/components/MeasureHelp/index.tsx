import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { typeScale } from 'theme/tokens'

interface MeasureHelpProps {
  /** The field's name, for the button: "¿Qué es el diámetro?". */
  label: string
  text: string
}

/**
 * The ⓘ next to a measure's label (backend specs/0013 RF-4): its meaning
 * and how to take it. Opens on a tap (no long press), on hover and on focus.
 */
export default function MeasureHelp({ label, text }: MeasureHelpProps) {
  return (
    <Tooltip
      title={text}
      arrow
      enterTouchDelay={0}
      leaveTouchDelay={8000}
      placement="top"
      // Readable on a phone: Material's tooltips are 11px
      slotProps={{ tooltip: { sx: { ...typeScale.caption, maxWidth: 280 } } }}
    >
      <IconButton
        size="small"
        aria-label={`¿Qué es ${label}?`}
        // Negative margin: the row keeps the label's height
        sx={{ p: 0.5, my: -1, color: 'text.secondary' }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  )
}
