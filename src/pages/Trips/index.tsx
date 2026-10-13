import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { sileo } from 'sileo'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ButtonBase from '@mui/material/ButtonBase'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import AltRouteIcon from '@mui/icons-material/AltRoute'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import EmptyState from 'components/EmptyState'
import FilterChip, { FilterBar } from 'components/FilterChip'
import FilterSheet, {
  appliedFilters,
  sheetFilter,
} from 'components/FilterSheet'
import NavBar from 'components/NavBar'
import SessionGate from 'components/SessionGate'
import TripStatusChip from 'components/TripStatusChip'
import { routeName } from 'schemas/rates'
import {
  TRIP_STATUS_LABELS,
  TRIP_STATUSES,
  tripIncome,
  type Trip,
} from 'schemas/trips'
import { useFleetStore } from 'store/fleet'
import { selectActiveRole, useSessionStore } from 'store/session'
import { tripsPeriodOf, useTripsStore } from 'store/trips'
import { layout, radius, softShadow, typeScale } from 'theme/tokens'
import { formatMeasurementDate, formatPeriod } from 'utils/formatDate'
import { moneyTotal } from 'utils/formatMoney'
import { canWriteFleet } from 'utils/roles'
import {
  DEFAULT_TRIP_ORDER,
  destinationOptions,
  filterTrips,
  groupSummary,
  groupTrips,
  NO_TRIP_FILTERS,
  sortTrips,
  TRIP_GROUPING_LABELS,
  TRIP_GROUPINGS,
  TRIP_ORDER_LABELS,
  TRIP_ORDERS,
  type TripFilters,
  type TripGroup,
  type TripNames,
} from 'utils/tripGroups'
import { OWNERSHIP_OPTIONS, thirdParty, tripOwnership } from 'utils/ownership'
import { tripTotals } from 'utils/tripTotals'
import { RETRY_HINT } from 'utils/withTimeout'
import { reportError } from 'utils/reportError'
import {
  tripReport,
  tripReportFileName,
  type TripPlates,
  type TripReportKind,
} from 'utils/tripReport'

const DateModal = lazy(() => import('components/DateModal'))

const STATUS_OPTIONS = TRIP_STATUSES.map(status => ({
  value: status,
  label: TRIP_STATUS_LABELS[status],
}))

const GROUPING_OPTIONS = TRIP_GROUPINGS.map(grouping => ({
  value: grouping,
  label: TRIP_GROUPING_LABELS[grouping],
}))

// The default, "Fecha, más reciente primero", is the chip's "all" option
const ORDER_OPTIONS = TRIP_ORDERS.filter(
  order => order !== DEFAULT_TRIP_ORDER
).map(order => ({ value: order, label: TRIP_ORDER_LABELS[order] }))

/** The names in a period's trips, once each, for a filter's options. */
const optionsOf = (pairs: [string, string][]) =>
  [...new Map(pairs)]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))

function TripCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const { clients, trucks, trailers, drivers } = useFleetStore()
  // "(de un tercero)" by the equipment that was (specs/0035 RF-7)
  const owned = tripOwnership(trip, { trucks, trailers })
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
        [
          thirdParty(nameOf(trucks, trip.truckId, trip.truckName), owned.truck),
          owned.trailer === 'third_party' &&
            thirdParty(
              nameOf(trailers, trip.trailerId, trip.trailerName),
              owned.trailer
            ),
          driverNames.join(' y '),
        ]
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

/** A group of the list: its name, what it adds up to and its trips (RF-4). */
function TripGroupSection({
  group,
  index,
  onOpen,
}: {
  group: TripGroup
  index: number
  onOpen: (trip: Trip) => void
}) {
  const titleId = `trip-group-${String(index)}`
  return (
    <Box component="section" aria-labelledby={titleId}>
      <Box sx={{ mb: 2 }}>
        <Typography
          id={titleId}
          variant="subtitle1"
          component="h2"
          sx={{ overflowWrap: 'anywhere' }}
        >
          {group.title}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}
        >
          {/* A route's client first (specs/0033 RF-2) */}
          {[group.subtitle, groupSummary(group.trips)]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      </Box>
      <Stack
        component="ul"
        spacing={2}
        aria-label={`Viajes de ${group.title}`}
        sx={{ listStyle: 'none', m: 0, p: 0 }}
      >
        {group.trips.map(trip => (
          <li key={trip.id}>
            <TripCard
              trip={trip}
              onClick={() => {
                onOpen(trip)
              }}
            />
          </li>
        ))}
      </Stack>
    </Box>
  )
}

function TripsScreen() {
  const [, navigate] = useLocation()
  const organization = useSessionStore(state => state.organization)
  const orgId = organization?.id ?? ''
  const role = useSessionStore(selectActiveRole)
  const canWrite = canWriteFleet(role)
  const trips = useTripsStore()
  const loadFleet = useFleetStore(state => state.load)
  const [pickerIsOpen, setPickerIsOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pdfMenu, setPdfMenu] = useState<HTMLElement | null>(null)
  // Kept in the store: back from a trip, the list is as it was (RF-8)
  const { load, view, setFilters, setGrouping, setOrder } = trips
  const { filters, grouping, order } = view

  useEffect(() => {
    if (!orgId) return
    void load(orgId)
    void loadFleet(orgId)
  }, [orgId, load, loadFleet])

  const period = tripsPeriodOf(trips)
  const periodText = formatPeriod(period)

  const { clients, trucks, trailers, drivers } = useFleetStore()
  // The current names, as the cards show them; the saved one if gone
  // (audit 0027)
  const options = useMemo(() => {
    const named =
      (items: readonly { id: string; name: string }[]) =>
      ([id, saved]: [string, string]): [string, string] => [
        id,
        items.find(item => item.id === id)?.name ?? saved,
      ]
    return {
      clients: optionsOf(
        trips.items.map(trip =>
          named(clients)([trip.clientId, trip.clientName])
        )
      ),
      trucks: optionsOf(
        trips.items.map(trip => named(trucks)([trip.truckId, trip.truckName]))
      ),
      drivers: optionsOf(
        trips.items
          .flatMap(trip => [
            [trip.driverId, trip.driverName] as [string, string],
            ...(trip.secondDriverId && trip.secondDriverName
              ? [
                  [trip.secondDriverId, trip.secondDriverName] as [
                    string,
                    string,
                  ],
                ]
              : []),
          ])
          .map(named(drivers))
      ),
    }
  }, [trips.items, clients, trucks, drivers])

  // The current names, for the groups too (specs/0030 RF-4)
  const names = useMemo((): TripNames => {
    const nameIn =
      (items: readonly { id: string; name: string }[]) =>
      (id: string, saved: string) =>
        items.find(item => item.id === id)?.name ?? saved
    return {
      client: nameIn(clients),
      truck: nameIn(trucks),
      trailer: nameIn(trailers),
      driver: nameIn(drivers),
    }
  }, [clients, trucks, trailers, drivers])
  // Each client's routes (specs/0033 RF-1)
  const destinations = useMemo(
    () => destinationOptions(trips.items, names),
    [trips.items, names]
  )

  // A filter whose option is not in the new period goes away (RF-8)
  useEffect(() => {
    if (trips.status !== 'ready') return
    const offered: Partial<Record<keyof TripFilters, { value: string }[]>> = {
      clientId: options.clients,
      truckId: options.trucks,
      driverId: options.drivers,
      destination: destinations,
    }
    const gone = Object.entries(offered).filter(
      ([key, choices]) =>
        filters[key as keyof TripFilters] !== null &&
        !choices.some(
          choice => choice.value === filters[key as keyof TripFilters]
        )
    )
    if (gone.length > 0)
      setFilters(Object.fromEntries(gone.map(([key]) => [key, null])))
  }, [trips.status, options, destinations, filters, setFilters])

  const shown = sortTrips(
    filterTrips(trips.items, filters, trip =>
      tripOwnership(trip, { trucks, trailers })
    ),
    order
  )
  const groups = grouping && groupTrips(shown, grouping, order, names)
  // The filters, for the sheet and for the PDF's heading (specs/0040 RF-3)
  const sheetFilters = [
    sheetFilter({
      label: 'Estado',
      allLabel: 'Todos',
      options: STATUS_OPTIONS,
      value: filters.status,
      onChange: status => {
        setFilters({ status })
      },
    }),
    sheetFilter({
      label: 'Cliente',
      list: true,
      allLabel: 'Todos',
      options: options.clients,
      value: filters.clientId,
      onChange: clientId => {
        setFilters({ clientId })
      },
    }),
    sheetFilter({
      label: 'Camión',
      list: true,
      allLabel: 'Todos',
      options: options.trucks,
      value: filters.truckId,
      onChange: truckId => {
        setFilters({ truckId })
      },
    }),
    sheetFilter({
      label: 'Conductor',
      list: true,
      allLabel: 'Todos',
      options: options.drivers,
      value: filters.driverId,
      onChange: driverId => {
        setFilters({ driverId })
      },
    }),
    sheetFilter({
      label: 'Destino',
      list: true,
      allLabel: 'Todos',
      options: destinations,
      value: filters.destination,
      onChange: destination => {
        setFilters({ destination })
      },
    }),
    // Own or of a third party (specs/0035 RF-6)
    sheetFilter({
      label: 'Dueño del camión',
      allLabel: 'Todos',
      options: OWNERSHIP_OPTIONS,
      value: filters.truckOwnership,
      onChange: truckOwnership => {
        setFilters({ truckOwnership })
      },
    }),
    sheetFilter({
      label: 'Dueño del remolque',
      allLabel: 'Todos',
      options: OWNERSHIP_OPTIONS,
      value: filters.trailerOwnership,
      onChange: trailerOwnership => {
        setFilters({ trailerOwnership })
      },
    }),
  ]
  const totals = tripTotals(shown)
  const filtered = Object.values(filters).some(value => value !== null)
  const open = (trip: Trip) => {
    navigate(`/viajes/${trip.id}`)
  }

  // What is on the screen, as a PDF (specs/0040 RF-2): no new read; the
  // drawing loads only now
  // The truck's and trailer's plates today, or their names (0041 RF-2)
  const plates: TripPlates = {
    truck: (id, saved) =>
      trucks.find(truck => truck.id === id)?.plate ?? names.truck(id, saved),
    trailer: (id, saved) =>
      trailers.find(trailer => trailer.id === id)?.plate ??
      names.trailer(id, saved),
  }

  const exportPdf = (kind: TripReportKind) => {
    setPdfMenu(null)
    const name = organization?.name ?? ''
    const report = tripReport({
      kind,
      organization: name,
      period: periodText,
      trips: shown,
      groups: groups || null,
      filters: appliedFilters(sheetFilters),
      client: filters.clientId
        ? (options.clients.find(client => client.value === filters.clientId)
            ?.label ?? null)
        : null,
      grouping: grouping ? TRIP_GROUPING_LABELS[grouping] : null,
      order: TRIP_ORDER_LABELS[order],
      names,
      plates,
      ownershipOf: trip => tripOwnership(trip, { trucks, trailers }),
      currency: organization?.defaultCurrency ?? 'USD',
      now: new Date(),
    })
    setExporting(true)
    import('services/tripPdf')
      .then(({ downloadTripReport }) => {
        downloadTripReport(report, tripReportFileName(kind, period, name))
        sileo.success({ title: 'PDF listo' })
      })
      .catch((error: unknown) => {
        reportError(error, {
          operation: 'exportTripsPdf',
          kind,
          trips: shown.length,
        })
        sileo.error({
          title: 'No pudimos generar el PDF',
          description: 'Vuelve a intentarlo.',
        })
      })
      .finally(() => {
        setExporting(false)
      })
  }

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
              setFilters(NO_TRIP_FILTERS)
            },
          }}
        />
      )
    }
    if (groups) {
      return (
        <Stack spacing={6}>
          {groups.map((group, index) => (
            <TripGroupSection
              key={group.key}
              group={group}
              index={index}
              onOpen={open}
            />
          ))}
          {grouping === 'driver' &&
            shown.some(trip => trip.secondDriverId !== null) && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Los viajes con dos conductores están en los dos grupos.
              </Typography>
            )}
        </Stack>
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
                open(trip)
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
          <Typography variant="pageTitle">Viajes</Typography>
          <Stack direction="row" spacing={2}>
            {/* For every role, with what the period has (specs/0040 RF-1) */}
            {trips.items.length > 0 && (
              <Button
                variant="outlined"
                startIcon={<PictureAsPdfOutlinedIcon />}
                aria-label="Exportar viajes en PDF"
                aria-haspopup="menu"
                disabled={shown.length === 0}
                loading={exporting}
                loadingPosition="start"
                onClick={event => {
                  setPdfMenu(event.currentTarget)
                }}
              >
                PDF
              </Button>
            )}
            {/* For the office or for the client's invoice (0041 RF-1) */}
            <Menu
              anchorEl={pdfMenu}
              open={pdfMenu !== null}
              onClose={() => {
                setPdfMenu(null)
              }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem
                onClick={() => {
                  exportPdf('internal')
                }}
              >
                <ListItemText
                  primary="Reporte interno"
                  secondary="Con gastos y utilidad"
                />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  exportPdf('client')
                }}
              >
                <ListItemText
                  primary="Soporte para el cliente"
                  secondary="Solo viajes e ingresos"
                />
              </MenuItem>
            </Menu>
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
          </Stack>
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

        {/* One row: "Filtros", "Agrupar" and "Ordenar" (specs/0039), once
            the period has trips */}
        {(trips.items.length > 0 || filtered) && (
          <Box sx={{ mb: 3 }}>
            <FilterBar>
              {/* The filters in a sheet; grouping and order stay in sight,
                  they are not filters (specs/0039 RF-1) */}
              <FilterSheet
                resultLabel={
                  shown.length === 1
                    ? 'Ver 1 viaje'
                    : `Ver ${String(shown.length)} viajes`
                }
                filters={sheetFilters}
              />
              <FilterChip
                label="Agrupar"
                allLabel="Sin agrupar"
                options={GROUPING_OPTIONS}
                value={grouping}
                onChange={setGrouping}
                named
                clearLabel="Quitar el agrupado"
              />
              <FilterChip
                label="Ordenar"
                allLabel={TRIP_ORDER_LABELS[DEFAULT_TRIP_ORDER]}
                options={ORDER_OPTIONS}
                value={order === DEFAULT_TRIP_ORDER ? null : order}
                onChange={chosen => {
                  setOrder(chosen ?? DEFAULT_TRIP_ORDER)
                }}
                named
                clearLabel="Ordenar por fecha, más reciente primero"
              />
            </FilterBar>
          </Box>
        )}

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
