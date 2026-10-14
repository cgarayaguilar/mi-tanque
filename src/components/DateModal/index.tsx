import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import CloseIcon from '@mui/icons-material/Close'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
// MUI X v7 (the version the license covers): this adapter is for date-fns 2,
// the app's version
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import type { PickersInputLocaleText } from '@mui/x-date-pickers/locales'
import { esES } from '@mui/x-date-pickers-pro/locales'
import { StaticDateRangePicker } from '@mui/x-date-pickers-pro/StaticDateRangePicker'
import type { DateRange, RangePosition } from '@mui/x-date-pickers-pro/models'
import { LicenseInfo } from '@mui/x-license'
import { addYears, endOfDay, isSameDay, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { radius, space } from 'theme/tokens'
import {
  chosenText,
  PERIOD_SHORTCUTS,
  shortcutDates,
  shortcutRange,
} from 'utils/periodShortcuts'

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
  /** Days after today can be chosen: Viajes' scheduled trips (specs/0044 RF-3). */
  allowFuture?: boolean
}

/** The quick periods' column beside the months, on a wider screen (RF-8). */
const SHORTCUTS_WIDTH = 200

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
 * A list's period (backend specs/0044): MUI X's range calendar in a dialog,
 * with quick periods. On a phone it fills the screen: the quick periods in
 * two columns, what is chosen, one month, and the buttons fixed below.
 */
export default function DateModal({
  initialRange,
  onSelect,
  onClose,
  allowFuture = false,
}: DateModalProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const [range, setRange] = useState<DateRange<Date>>([
    initialRange.startDate,
    initialRange.endDate,
  ])
  const [position, setPosition] = useState<RangePosition>('start')
  // Fresh: on opening and after a quick period. The calendar is told the
  // end is being chosen, so it shows the period's last month (RF-9), and the
  // next day tapped starts a new period instead of moving its end
  const [fresh, setFresh] = useState(true)
  const [start, end] = range
  const today = new Date()

  const apply = () => {
    if (start && end)
      onSelect({ startDate: startOfDay(start), endDate: endOfDay(end) })
    onClose()
  }

  const shortcuts = (
    <Box
      role="group"
      aria-label="Periodos rápidos"
      sx={{
        display: 'grid',
        // Two columns on a phone (RF-7), one beside the months (RF-8)
        gridTemplateColumns: phone ? 'repeat(2, minmax(0, 1fr))' : '1fr',
        gap: 1,
        alignContent: 'start',
      }}
    >
      {PERIOD_SHORTCUTS.map(shortcut => {
        const [from, to] = shortcutRange(shortcut, today, allowFuture)
        const active =
          start !== null &&
          end !== null &&
          isSameDay(start, from) &&
          isSameDay(end, to)
        return (
          <Button
            key={shortcut.label}
            variant={active ? 'contained' : 'outlined'}
            aria-pressed={active}
            onClick={() => {
              setRange([from, to])
              setFresh(true)
            }}
            sx={{
              // Two lines: the name and its dates (RF-1); 44 px at least
              minHeight: space.xxl,
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              textAlign: 'left',
              px: 2,
              py: 1,
              borderRadius: `${String(radius.md)}px`,
            }}
          >
            <Box component="span" sx={{ color: 'inherit' }}>
              {shortcut.label}
            </Box>
            <Box
              component="span"
              sx={{
                typography: 'caption',
                color: active ? 'inherit' : 'text.secondary',
              }}
            >
              {shortcutDates([from, to], today)}
            </Box>
          </Button>
        )
      })}
    </Box>
  )

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={phone}
      maxWidth="md"
      aria-labelledby="date-modal-title"
    >
      <DialogTitle
        id="date-modal-title"
        sx={{ display: 'flex', alignItems: 'center', gap: 2, pr: 2 }}
      >
        <Box component="span" sx={{ flexGrow: 1 }}>
          Elige el periodo
        </Box>
        <IconButton aria-label="Cerrar" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: phone ? 'column' : 'row',
          gap: 3,
          px: phone ? 2 : 3,
        }}
      >
        <Box sx={phone ? undefined : { width: SHORTCUTS_WIDTH, flexShrink: 0 }}>
          {shortcuts}
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            role="status"
            variant="body2"
            sx={{ color: 'text.secondary', mb: 1 }}
          >
            {start && end ? chosenText([start, end]) : 'Elige el último día'}
          </Typography>
          <LocalizationProvider
            dateAdapter={AdapterDateFns}
            adapterLocale={es}
            localeText={localeText}
          >
            <StaticDateRangePicker
              value={range}
              onChange={next => {
                if (fresh) {
                  // The day tapped starts the new period
                  setRange([next[1] ?? next[0], null])
                  setPosition('end')
                  setFresh(false)
                  return
                }
                setRange(next)
              }}
              rangePosition={fresh ? 'end' : position}
              onRangePositionChange={next => {
                if (!fresh) setPosition(next)
              }}
              calendars={phone ? 1 : 2}
              minDate={MIN_DATE}
              maxDate={allowFuture ? addYears(today, 1) : today}
              disableFuture={!allowFuture}
              displayStaticWrapperAs="desktop"
              slotProps={{ actionBar: { actions: [] } }}
              sx={{
                bgcolor: 'transparent',
                // One month as wide as the phone, centered (RF-7)
                '& .MuiDateRangeCalendar-root': {
                  justifyContent: 'center',
                },
              }}
            />
          </LocalizationProvider>
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          // Above the iPhone's home bar (RF-7)
          pb: `calc(${String(space.sm)}px + env(safe-area-inset-bottom))`,
        }}
      >
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={apply} disabled={!start || !end}>
          Aplicar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
