import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import AltRouteIcon from '@mui/icons-material/AltRoute'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import EmptyState from 'components/EmptyState'
import FilterChip, { FilterBar } from 'components/FilterChip'
import NavBar from 'components/NavBar'
import SessionGate from 'components/SessionGate'
import TripStatusChip from 'components/TripStatusChip'
import { routeName } from 'schemas/rates'
import {
  TRIP_STATUS_LABELS,
  TRIP_STATUSES,
  tripIncome,
  type Trip,
  type TripStatus,
} from 'schemas/trips'
import { useFleetStore } from 'store/fleet'
import { selectActiveRole, useSessionStore } from 'store/session'
import { tripsPeriodOf, useTripsStore } from 'store/trips'
import { layout, radius, softShadow, typeScale } from 'theme/tokens'
import { formatMeasurementDate, formatPeriod } from 'utils/formatDate'
import { moneyTotal } from 'utils/formatMoney'
import { canWriteFleet } from 'utils/roles'
import { tripTotals } from 'utils/tripTotals'
import { RETRY_HINT } from 'utils/withTimeout'

const DateModal = lazy(() => import('components/DateModal'))

const STATUS_OPTIONS = TRIP_STATUSES.map(status => ({
  value: status,
  label: TRIP_STATUS_LABELS[status],
}))

/** The names in a period's trips, once each, for a filter's options. */
const optionsOf = (pairs: [string, string][]) =>
  [...new Map(pairs)]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))

function TripCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const { clients, trucks, drivers } = useFleetStore()
  const nameOf = (
    items: readonly { id: string; name: string }[],
    id: string | null,
    saved: string | null
  ) => (id ? (items.find(item => item.id === id)?.name ?? saved) : saved)
  const route = routeName(trip.origin, trip.destination)
  const driverNames = [
    nameOf(drivers, trip.driverId, trip.driverName),
    nameOf(drivers, trip.secondDriverId, trip.secondDriverName),
  ].filter(Boolean)
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={`Viaje ${route}, ${TRIP_STATUS_LABELS[trip.status]}`}
      sx={{
        width: '100%',
        display: 'block',
        px: 4,
        py: 3,
        textAlign: 'left',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.lg)}px`,
        opacity: trip.status === 'cancelled' ? 0.7 : 1,
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: softShadow },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Typography
          component="span"
          variant="subtitle1"
          sx={{ flexGrow: 1, minWidth: 0, overflowWrap: 'anywhere' }}
        >
          {route}
        </Typography>
        <TripStatusChip status={trip.status} />
      </Box>
      <Typography
        component="span"
        noWrap
        sx={{ ...typeScale.figureSm, display: 'block', my: 0.5 }}
      >
        {moneyTotal(trip.currency, tripIncome(trip))}
      </Typography>
      {[
        formatMeasurementDate(trip.startAt),
        nameOf(clients, trip.clientId, trip.clientName),
        [nameOf(trucks, trip.truckId, trip.truckName), driverNames.join(' y ')]
          .filter(Boolean)
          .join(' · '),
      ].map(line => (
        <Typography
          key={line}
          component="span"
          variant="caption"
          noWrap
          sx={{ display: 'block', color: 'text.secondary' }}
        >
          {line}
        </Typography>
      ))}
    </ButtonBase>
  )
}

function TripsScreen() {
  const [, navigate] = useLocation()
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const role = useSessionStore(selectActiveRole)
  const canWrite = canWriteFleet(role)
  const trips = useTripsStore()
  const loadFleet = useFleetStore(state => state.load)
  const [pickerIsOpen, setPickerIsOpen] = useState(false)
  const [status, setStatus] = useState<TripStatus | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [truckId, setTruckId] = useState<string | null>(null)
  const [driverId, setDriverId] = useState<string | null>(null)
  const { load } = trips

  useEffect(() => {
    if (!orgId) return
    void load(orgId)
    void loadFleet(orgId)
  }, [orgId, load, loadFleet])

  const period = tripsPeriodOf(trips)
  const periodText = formatPeriod(period)

  const options = useMemo(
    () => ({
      clients: optionsOf(
        trips.items.map(trip => [trip.clientId, trip.clientName])
      ),
      trucks: optionsOf(
        trips.items.map(trip => [trip.truckId, trip.truckName])
      ),
      drivers: optionsOf(
        trips.items.flatMap(trip => [
          [trip.driverId, trip.driverName] as [string, string],
          ...(trip.secondDriverId && trip.secondDriverName
            ? [[trip.secondDriverId, trip.secondDriverName] as [string, string]]
            : []),
        ])
      ),
    }),
    [trips.items]
  )

  const shown = trips.items.filter(
    trip =>
      (status === null || trip.status === status) &&
      (clientId === null || trip.clientId === clientId) &&
      (truckId === null || trip.truckId === truckId) &&
      (driverId === null || trip.driverIds.includes(driverId))
  )
  const totals = tripTotals(shown)
  const filtered =
    status !== null ||
    clientId !== null ||
    truckId !== null ||
    driverId !== null

  const renderList = () => {
    if (trips.status === 'error' && trips.items.length === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<CloudOffIcon />}
          title="No pudimos cargar los viajes"
          description={RETRY_HINT}
          action={{ label: 'Reintentar', onClick: () => void load(orgId) }}
        />
      )
    }
    if (trips.status !== 'ready' && trips.items.length === 0) {
      return (
        <Stack spacing={2} aria-busy="true" aria-label="Cargando viajes">
          {[0, 1, 2].map(index => (
            <Skeleton
              key={index}
              variant="rounded"
              height={120}
              sx={{ borderRadius: `${String(radius.lg)}px` }}
            />
          ))}
        </Stack>
      )
    }
    if (trips.items.length === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<AltRouteIcon />}
          title="No hay viajes en este periodo"
          description={
            canWrite
              ? 'Agrega un viaje o elige otro periodo.'
              : 'Elige otro periodo.'
          }
          {...(canWrite && {
            action: {
              label: 'Agregar viaje',
              onClick: () => {
                navigate('/viajes/nuevo')
              },
            },
          })}
        />
      )
    }
    if (shown.length === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<SearchOffIcon />}
          title="Sin resultados"
          description="Ningún viaje del periodo cumple los filtros."
          action={{
            label: 'Quitar filtros',
            onClick: () => {
              setStatus(null)
              setClientId(null)
              setTruckId(null)
              setDriverId(null)
            },
          }}
        />
      )
    }
    return (
      <Stack
        component="ul"
        spacing={2}
        aria-label="Viajes"
        sx={{ listStyle: 'none', m: 0, p: 0 }}
      >
        {shown.map(trip => (
          <li key={trip.id}>
            <TripCard
              trip={trip}
              onClick={() => {
                navigate(`/viajes/${trip.id}`)
              }}
            />
          </li>
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
      <Box sx={{ px: 4, pt: 2, pb: 4, flexGrow: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            mb: 4,
          }}
        >
          <Typography variant="h3" component="h1">
            Viajes
          </Typography>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                navigate('/viajes/nuevo')
              }}
            >
              Agregar
            </Button>
          )}
        </Box>

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
          onClick={() => {
            setPickerIsOpen(true)
          }}
          aria-label={`Periodo: ${periodText}. Cambiar`}
          sx={{ justifyContent: 'flex-start', mb: 3 }}
        >
          {periodText}
        </Button>

        {/* One row of chips (specs/0017), with what the period has */}
        <Box sx={{ mb: 3 }}>
          <FilterBar>
            <FilterChip
              label="Estado"
              allLabel="Todos"
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
            />
            {options.clients.length > 1 && (
              <FilterChip
                label="Cliente"
                allLabel="Todos"
                options={options.clients}
                value={clientId}
                onChange={setClientId}
              />
            )}
            {options.trucks.length > 1 && (
              <FilterChip
                label="Camión"
                allLabel="Todos"
                options={options.trucks}
                value={truckId}
                onChange={setTruckId}
              />
            )}
            {options.drivers.length > 1 && (
              <FilterChip
                label="Conductor"
                allLabel="Todos"
                options={options.drivers}
                value={driverId}
                onChange={setDriverId}
              />
            )}
          </FilterBar>
        </Box>

        {trips.items.length > 0 && (
          <Box
            role="status"
            aria-label={
              filtered ? 'Totales de lo filtrado' : 'Totales del periodo'
            }
            sx={{
              mb: 4,
              px: 4,
              py: 3,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: `${String(radius.lg)}px`,
            }}
          >
            <Typography variant="body2">
              {totals.count === 1
                ? '1 viaje'
                : `${String(totals.count)} viajes`}
            </Typography>
            {totals.count > 0 && (
              <Box
                component="dl"
                sx={{
                  m: 0,
                  mt: 2,
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr)',
                  columnGap: 3,
                  rowGap: 0.5,
                }}
              >
                {[
                  { label: 'Ingresos', values: totals.income },
                  { label: 'Gastos', values: totals.expenses },
                  { label: 'Utilidad', values: totals.profit },
                ].map(({ label, values }) => (
                  <Box key={label} sx={{ display: 'contents' }}>
                    <Typography
                      component="dt"
                      variant="caption"
                      sx={{ color: 'text.secondary' }}
                    >
                      {label}
                    </Typography>
                    <Typography
                      component="dd"
                      variant="caption"
                      sx={{ m: 0, textAlign: 'right' }}
                    >
                      {values.map((value, index) => (
                        <Box
                          key={value}
                          component="span"
                          sx={{
                            display: 'block',
                            ...(label === 'Utilidad' &&
                              totals.losing[index] && { color: 'error.main' }),
                          }}
                        >
                          {value}
                        </Box>
                      ))}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
            <Typography
              variant="caption"
              component="p"
              sx={{ mt: 1, color: 'text.secondary' }}
            >
              Sin los cancelados.
            </Typography>
          </Box>
        )}

        {trips.truncated && (
          <Alert severity="info" sx={{ mb: 4 }}>
            Mostramos los 1000 más recientes. Elige un periodo más corto.
          </Alert>
        )}

        {renderList()}
      </Box>
      <NavBar />

      {pickerIsOpen && (
        <Suspense fallback={null}>
          <DateModal
            initialRange={{ startDate: period.start, endDate: period.end }}
            onSelect={({ startDate, endDate }) =>
              void trips.choosePeriod({ start: startDate, end: endDate })
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

export default function Trips() {
  return (
    <SessionGate needs="ready">
      <TripsScreen />
    </SessionGate>
  )
}
