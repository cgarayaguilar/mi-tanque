import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
// MUI X v7 (the version the license covers): this adapter is for date-fns 2,
// the app's version
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import type { PickersInputLocaleText } from '@mui/x-date-pickers/locales'
import { esES } from '@mui/x-date-pickers-pro/locales'
import { StaticDateRangePicker } from '@mui/x-date-pickers-pro/StaticDateRangePicker'
import type { DateRange } from '@mui/x-date-pickers-pro/models'
import { LicenseInfo } from '@mui/x-license'
import { isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { PERIOD_SHORTCUTS } from './periodShortcuts'

// MUI X Pro license from the environment (never committed). This module is
// a lazy chunk: the license and the picker load only when choosing a period
const licenseKey = import.meta.env.VITE_MUI_X_LICENSE_KEY
if (licenseKey) LicenseInfo.setLicenseKey(licenseKey)

export interface DateRangeSelection {
  startDate: Date
  endDate: Date
}

interface DateModalProps {
  initialRange: DateRangeSelection
  onSelect: (range: DateRangeSelection) => void
  onClose: () => void
}

// Earliest date the app can hold measurements for
const MIN_DATE = new Date(2020, 0, 6)

// Spanish texts; the locale marks every key optional, the provider wants
// the ones it has
const localeText = Object.fromEntries(
  Object.entries(
    esES.components.MuiLocalizationProvider.defaultProps.localeText
  ).filter(([, text]) => text !== undefined)
) as PickersInputLocaleText<Date>

/**
 * The history's period (ADR 0001, phase 3): MUI X's range calendar in a
 * dialog, with quick periods. Replaces react-date-range and its patch.
 */
export default function DateModal({
  initialRange,
  onSelect,
  onClose,
}: DateModalProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [range, setRange] = useState<DateRange<Date>>([
    initialRange.startDate,
    initialRange.endDate,
  ])
  const [start, end] = range
  const today = new Date()

  const apply = () => {
    if (start && end) onSelect({ startDate: start, endDate: end })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="md"
      aria-labelledby="date-modal-title"
    >
      <DialogTitle id="date-modal-title">Selecciona un periodo</DialogTitle>
      <DialogContent sx={{ px: 0 }}>
        {/* Above the month, not beside it: a phone keeps all 7 weekdays */}
        <Box
          role="group"
          aria-label="Periodos rápidos"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}
        >
          {PERIOD_SHORTCUTS.map(shortcut => {
            const [from, to] = shortcut.range(today)
            const active =
              start !== null &&
              end !== null &&
              isSameDay(start, from) &&
              isSameDay(end, to)
            return (
              <Chip
                key={shortcut.label}
                label={shortcut.label}
                color={active ? 'primary' : 'default'}
                aria-pressed={active}
                onClick={() => {
                  setRange([from, to])
                }}
              />
            )
          })}
        </Box>
        <LocalizationProvider
          dateAdapter={AdapterDateFns}
          adapterLocale={es}
          localeText={localeText}
        >
          <StaticDateRangePicker
            value={range}
            onChange={setRange}
            calendars={fullScreen ? 1 : 2}
            minDate={MIN_DATE}
            maxDate={today}
            disableFuture
            displayStaticWrapperAs="desktop"
            slotProps={{ actionBar: { actions: [] } }}
          />
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={apply} disabled={!start || !end}>
          Aplicar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
