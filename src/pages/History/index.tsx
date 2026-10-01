import { lazy, Suspense, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import HistoryIcon from '@mui/icons-material/History'
import EmptyState from 'components/EmptyState'
import NavBar from 'components/NavBar'
import TankHistoryCard from 'components/TankHistoryCard'
import { defaultPeriod, useHistoryStore } from 'store/history'
import { layout, radius } from 'theme/tokens'
import type { Period } from 'types'
import { formatPeriod } from 'utils/formatDate'

// The calendar is heavy: it loads the first time the picker opens
const DateModal = lazy(() => import('components/DateModal'))

// Roughly a collapsed TankHistoryCard
const CARD_HEIGHT = 248
const PLACEHOLDER_CARDS = 2

export default function History() {
  const chosenPeriod = useHistoryStore(state => state.chosenPeriod)
  const status = useHistoryStore(state => state.status)
  const histories = useHistoryStore(state => state.histories)
  const load = useHistoryStore(state => state.load)
  const choosePeriod = useHistoryStore(state => state.choosePeriod)
  const [pickerIsOpen, setPickerIsOpen] = useState(false)

  const period: Period = chosenPeriod ?? defaultPeriod()
  const periodText = formatPeriod(period)

  useEffect(() => {
    void load()
  }, [load])

  const openPicker = () => {
    setPickerIsOpen(true)
  }

  const renderHistories = () => {
    if (status === 'error' && histories.length === 0)
      return (
        <EmptyState
          headingLevel="h2"
          icon={<CloudOffIcon />}
          title="No pudimos cargar el historial"
          description="Revisa que tu navegador permita guardar datos y vuelve a intentarlo."
          action={{ label: 'Reintentar', onClick: () => void load() }}
        />
      )

    if (status !== 'ready' && histories.length === 0)
      return (
        <Stack spacing={4} aria-busy="true" aria-label="Cargando historial">
          {Array.from({ length: PLACEHOLDER_CARDS }, (_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              height={CARD_HEIGHT}
              sx={{ borderRadius: `${String(radius.xl)}px` }}
            />
          ))}
        </Stack>
      )

    if (histories.length === 0)
      return (
        <EmptyState
          headingLevel="h2"
          icon={<HistoryIcon />}
          title="Sin mediciones en este periodo"
          description="Elige otro periodo o haz una medición."
          action={{ label: 'Cambiar periodo', onClick: openPicker }}
        />
      )

    return (
      <Stack spacing={4}>
        {histories.map(history => (
          <TankHistoryCard
            key={history.tank.id}
            history={history}
            // A single tank opens its measurements right away
            defaultExpanded={histories.length === 1}
          />
        ))}
      </Stack>
    )
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: `calc(100dvh - ${String(layout.appBarHeight)}px)`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: 4, flexGrow: 1 }}>
        <Typography variant="h3" component="h1">
          Historial
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, mb: 4 }}>
          Tus mediciones por tanque en el periodo que elijas.
        </Typography>

        <Typography
          variant="overline"
          component="p"
          sx={{ color: 'text.secondary', mb: 1 }}
        >
          Periodo
        </Typography>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<CalendarMonthIcon />}
          onClick={openPicker}
          aria-label={`Periodo: ${periodText}. Cambiar`}
          sx={{ justifyContent: 'flex-start', mb: 6 }}
        >
          {periodText}
        </Button>

        {renderHistories()}
      </Box>

      <NavBar />

      {pickerIsOpen && (
        <Suspense fallback={null}>
          <DateModal
            initialRange={{ startDate: period.start, endDate: period.end }}
            onSelect={({ startDate, endDate }) =>
              void choosePeriod({ start: startDate, end: endDate })
            }
            onClose={() => {
              setPickerIsOpen(false)
            }}
          />
        </Suspense>
      )}
    </Box>
  )
}
