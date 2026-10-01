import { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { es } from 'date-fns/locale'
import { DateRange, type Range, type RangeKeyDict } from 'react-date-range'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'

export interface DateRangeSelection {
  startDate: Date
  endDate: Date
}

interface DateModalProps {
  initialRange: DateRangeSelection
  onSelect: (range: DateRangeSelection) => void
  onClose: () => void
}

const RANGE_KEY = 'selection'
// Earliest date the app can hold measurements for
const MIN_DATE = new Date(2020, 0, 6)

export default function DateModal({
  initialRange,
  onSelect,
  onClose,
}: DateModalProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [range, setRange] = useState<Range>({ ...initialRange, key: RANGE_KEY })

  const handleChange = (ranges: RangeKeyDict) => {
    const selection = ranges[RANGE_KEY]
    if (selection) setRange(selection)
  }

  const apply = () => {
    const { startDate, endDate } = range
    if (startDate && endDate) onSelect({ startDate, endDate })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={fullScreen}
      aria-labelledby="date-modal-title"
    >
      <DialogTitle id="date-modal-title">Selecciona un periodo</DialogTitle>
      <DialogContent sx={{ px: 0, display: 'flex', justifyContent: 'center' }}>
        <DateRange
          ranges={[range]}
          onChange={handleChange}
          locale={es}
          rangeColors={[theme.palette.primary.main]}
          color={theme.palette.primary.main}
          showMonthArrow={false}
          editableDateInputs
          moveRangeOnFirstSelection={false}
          scroll={{ enabled: true, calendarHeight: 500 }}
          minDate={MIN_DATE}
          maxDate={new Date()}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={apply}>
          Aplicar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
