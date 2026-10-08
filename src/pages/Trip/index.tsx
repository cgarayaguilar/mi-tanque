import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useParams } from 'wouter'
import { sileo } from 'sileo'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import ConfirmDialog from 'components/ConfirmDialog'
import EmptyState from 'components/EmptyState'
import SessionGate from 'components/SessionGate'
import TripStatusChip from 'components/TripStatusChip'
import { useTrip } from 'hooks/useTrip'
import { useTripExpenses } from 'hooks/useTripExpenses'
import { totalsByCategory, type Expense } from 'schemas/expenses'
import { rateLabel, routeName } from 'schemas/rates'
import { toCents, tripIncome, type Trip } from 'schemas/trips'
import { deleteTrip } from 'services/trips'
import { useExpensesStore } from 'store/expenses'
import { useFleetStore } from 'store/fleet'
import {
  recoverFromLostPermission,
  selectActiveRole,
  useSessionStore,
} from 'store/session'
import { useTripsStore } from 'store/trips'
import { moneyTotal } from 'utils/formatMoney'
import { reportError } from 'utils/reportError'
import { canWriteFleet } from 'utils/roles'
import { RETRY_HINT } from 'utils/withTimeout'

/** "lun 6 oct 2026, 08:00" */
const tripDateTime = (date: Date) =>
  format(date, 'EEE d MMM yyyy, HH:mm', { locale: es })

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography
        variant="caption"
        component="p"
        sx={{ color: 'text.secondary' }}
      >
        {label}
      </Typography>
      <Typography variant="body1" component="div">
        {children}
      </Typography>
    </Box>
  )
}

function MoneyLine({ label, amount }: { label: string; amount: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 2,
        alignItems: 'baseline',
      }}
    >
      <Typography
        variant="body2"
        sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {amount}
      </Typography>
    </Box>
  )
}

/** "6 oct · Peajes · Tipitapa" and its amount, opening the expense. */
function ExpenseLine({
  expense,
  category,
  onClick,
}: {
  expense: Expense
  category: string
  onClick: () => void
}) {
  const text = [
    format(expense.takenAt, 'd MMM', { locale: es }),
    category,
    expense.description,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={`Gasto: ${text}, ${moneyTotal(expense.currency, expense.amount)}`}
      sx={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 2,
        py: 1,
        textAlign: 'left',
        borderRadius: 1,
      }}
    >
      <Typography
        variant="body2"
        sx={{ flexGrow: 1, minWidth: 0, overflowWrap: 'anywhere' }}
      >
        {text}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {moneyTotal(expense.currency, expense.amount)}
      </Typography>
      <ChevronRightIcon
        fontSize="small"
        aria-hidden="true"
        sx={{ alignSelf: 'center', color: 'text.secondary', mr: -1 }}
      />
    </ButtonBase>
  )
}

function TripDetails({ trip }: { trip: Trip }) {
  const [, navigate] = useLocation()
  const { clients, trucks, trailers, drivers, members } = useFleetStore()
  const removeTrip = useTripsStore(state => state.remove)
  const role = useSessionStore(selectActiveRole)
  const canWrite = canWriteFleet(role)
  const [confirming, setConfirming] = useState(false)
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const categories = useExpensesStore(state => state.categories)
  const loadCategories = useExpensesStore(state => state.loadCategories)
  const applyTripExpenses = useExpensesStore(state => state.applyTripExpenses)
  const [expensesStatus, expenses, retryExpenses] = useTripExpenses(
    orgId,
    trip.id
  )

  useEffect(() => {
    if (orgId) void loadCategories(orgId)
  }, [orgId, loadCategories])

  // The current names, or the ones saved with the trip (RF-1)
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
  const author = members.find(member => member.uid === trip.createdBy)
  const truckName =
    nameOf(trucks, trip.truckId, trip.truckName) ?? trip.truckName
  const categoryName = (id: string) =>
    categories.find(category => category.id === id)?.name ?? null

  // What it read, or what the backend added up (RF-3) while it reads; as
  // the backend, only those in the trip's currency
  const spent =
    expensesStatus === 'ready'
      ? toCents(
          expenses
            .filter(expense => expense.currency === trip.currency)
            .reduce((sum, expense) => sum + expense.amount, 0)
        )
      : trip.expensesTotal
  const profit = toCents(tripIncome(trip) - spent)
  const byCategory = totalsByCategory(expenses, categoryName)

  const confirmDelete = () => {
    setConfirming(false)
    removeTrip(trip.id, () => deleteTrip(trip.id)).catch((error: unknown) => {
      reportError(error, { operation: 'deleteTrip' })
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: 'No pudimos borrar el viaje',
        description: 'Vuelve a intentarlo.',
      })
    })
    // Its expenses stay with its truck (RF-6): the backend moves them
    // A refuel's goes back to its own truck, trailer or general: the
    // backend knows which (specs/0027 RF-5)
    applyTripExpenses(
      expenses
        .filter(expense => expense.refuelId === null)
        .map(expense => ({
          ...expense,
          kind: 'truck',
          tripId: null,
          tripRoute: null,
        })),
      []
    )
    sileo.success({ title: 'Viaje borrado' })
    navigate('/viajes')
  }

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
        >
          {route}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 6 }}>
        <TripStatusChip status={trip.status} />
        {trip.tripNumber && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Viaje {trip.tripNumber}
          </Typography>
        )}
      </Stack>

      <Stack spacing={4}>
        <Row label="Inicio">{tripDateTime(trip.startAt)}</Row>
        <Row label="Fin">
          {trip.endAt ? tripDateTime(trip.endAt) : 'Sin terminar'}
        </Row>
        <Row label="Periodo">
          Semana {trip.weekLabel} · {trip.monthLabel}
        </Row>
        <Row label="Cliente">
          {nameOf(clients, trip.clientId, trip.clientName)}
        </Row>
        <Row label="Camión">{nameOf(trucks, trip.truckId, trip.truckName)}</Row>
        <Row label="Remolque">
          {nameOf(trailers, trip.trailerId, trip.trailerName) ?? 'Sin remolque'}
        </Row>
        <Row label={driverNames.length > 1 ? 'Conductores' : 'Conductor'}>
          {driverNames.join(' y ')}
        </Row>
        <Row label="Precio">
          {trip.mode === 'rate'
            ? `Desde la tarifa ${rateLabel(trip.origin, trip.destination, trip.price, trip.currency)}`
            : 'Manual'}
        </Row>
      </Stack>

      <Divider sx={{ my: 6 }} />

      <Box component="section" aria-labelledby="trip-income-title">
        <Typography
          id="trip-income-title"
          variant="overline"
          component="h2"
          sx={{ color: 'text.secondary' }}
        >
          Ingresos
        </Typography>
        <Stack spacing={1} sx={{ mt: 2 }}>
          <MoneyLine
            label="Precio del viaje"
            amount={moneyTotal(trip.currency, trip.price)}
          />
          {trip.extras.map((extra, index) => (
            <MoneyLine
              key={`${extra.description}-${String(index)}`}
              label={extra.description}
              amount={moneyTotal(trip.currency, extra.amount)}
            />
          ))}
          <Divider />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              alignItems: 'baseline',
            }}
          >
            <Typography variant="subtitle1">Total</Typography>
            <Typography variant="subtitle1" sx={{ whiteSpace: 'nowrap' }}>
              {moneyTotal(trip.currency, tripIncome(trip))}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ my: 6 }} />

      <Box component="section" aria-labelledby="trip-expenses-title">
        <Typography
          id="trip-expenses-title"
          variant="overline"
          component="h2"
          sx={{ color: 'text.secondary' }}
        >
          Gastos
        </Typography>
        {expensesStatus === 'error' && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No pudimos cargar los gastos. {RETRY_HINT}
            </Typography>
            <Button onClick={retryExpenses} sx={{ ml: -2 }}>
              Reintentar
            </Button>
          </Box>
        )}
        {expensesStatus === 'loading' && (
          <Skeleton variant="rounded" height={64} sx={{ mt: 2 }} />
        )}
        {expensesStatus === 'ready' && (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {expenses.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Este viaje no tiene gastos.
              </Typography>
            )}
            {byCategory.map(item => (
              <MoneyLine
                key={`${item.name}|${item.currency}`}
                label={item.name}
                amount={moneyTotal(item.currency, item.amount)}
              />
            ))}
            {expenses.length > 0 && (
              <>
                <Divider />
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {expenses.map(expense => (
                    <li key={expense.id}>
                      <ExpenseLine
                        expense={expense}
                        category={
                          categoryName(expense.categoryId) ??
                          expense.categoryName
                        }
                        onClick={() => {
                          navigate(`/gastos/${expense.id}?viaje=${trip.id}`)
                        }}
                      />
                    </li>
                  ))}
                </Box>
              </>
            )}
          </Stack>
        )}
        {canWrite && (
          <Button
            startIcon={<AddIcon />}
            onClick={() => {
              navigate(`/gastos/nuevo?viaje=${trip.id}`)
            }}
            sx={{ mt: 1, ml: -2 }}
          >
            Agregar gasto
          </Button>
        )}
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1}>
          <MoneyLine
            label="Total de gastos"
            amount={moneyTotal(trip.currency, spent)}
          />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              alignItems: 'baseline',
            }}
          >
            <Typography variant="subtitle1">Utilidad</Typography>
            <Typography
              variant="subtitle1"
              sx={{
                whiteSpace: 'nowrap',
                color: profit < 0 ? 'error.main' : 'text.primary',
              }}
            >
              {moneyTotal(trip.currency, profit)}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {(trip.description ?? trip.notes) && (
        <>
          <Divider sx={{ my: 6 }} />
          <Stack spacing={4}>
            {trip.description && (
              <Row label="Descripción">{trip.description}</Row>
            )}
            {trip.notes && <Row label="Notas">{trip.notes}</Row>}
          </Stack>
        </>
      )}

      <Typography
        variant="caption"
        component="p"
        sx={{ mt: 6, color: 'text.secondary' }}
      >
        {trip.createdAt
          ? `Agregado el ${format(trip.createdAt, 'd MMM yyyy, HH:mm', { locale: es })}`
          : 'Agregado hace un momento'}
        {author ? ` por ${author.displayName}` : ''}
      </Typography>

      {canWrite && (
        <Stack spacing={3} sx={{ mt: 8 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<EditOutlinedIcon />}
            onClick={() => {
              navigate(`/viajes/${trip.id}/editar`)
            }}
          >
            Editar
          </Button>
          <Button
            variant="outlined"
            size="large"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => {
              setConfirming(true)
            }}
          >
            Borrar
          </Button>
        </Stack>
      )}

      <ConfirmDialog
        open={confirming}
        title={`¿Borrar el viaje ${route}?`}
        description={
          // Not read yet, but it has some (its total): still said
          expensesStatus !== 'ready' && trip.expensesTotal > 0
            ? `Sus gastos quedarán como gastos del camión ${truckName}. No se puede deshacer.`
            : expenses.length === 0
              ? 'No se puede deshacer.'
              : `${
                  expenses.length === 1
                    ? 'Su gasto quedará como gasto'
                    : `Sus ${String(expenses.length)} gastos quedarán como gastos`
                } del camión ${truckName}. No se puede deshacer.`
        }
        confirmLabel="Borrar"
        onConfirm={confirmDelete}
        onClose={() => {
          setConfirming(false)
        }}
      />
    </>
  )
}

function TripScreen() {
  const params = useParams<{ id?: string }>()
  const [, navigate] = useLocation()
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const loadFleet = useFleetStore(state => state.load)
  const [loaded, retry] = useTrip(params.id ?? null)

  useEffect(() => {
    if (orgId) void loadFleet(orgId)
  }, [orgId, loadFleet])

  const body = () => {
    switch (loaded.status) {
      case 'ready':
        return <TripDetails trip={loaded.trip} />
      case 'missing':
        return (
          <EmptyState
            icon={<SearchOffIcon />}
            title="No encontramos ese viaje"
            description="Puede que lo hayan borrado o que pertenezca a otra organización."
            action={{
              label: 'Ver viajes',
              onClick: () => {
                navigate('/viajes')
              },
            }}
          />
        )
      case 'error':
        return (
          <EmptyState
            icon={<CloudOffIcon />}
            title="No pudimos cargar el viaje"
            description={RETRY_HINT}
            action={{ label: 'Reintentar', onClick: retry }}
          />
        )
      case 'loading':
        return (
          <Box aria-busy="true" aria-label="Cargando">
            <Skeleton variant="text" width="60%" height={48} />
            <Skeleton variant="rounded" height={320} sx={{ mt: 4 }} />
          </Box>
        )
    }
  }

  return (
    <Box component="main" sx={{ px: 4, pt: 2, pb: 8 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => {
          navigate('/viajes')
        }}
        sx={{ ml: -2, mb: 2 }}
      >
        Viajes
      </Button>
      {body()}
    </Box>
  )
}

export default function TripPage() {
  return (
    <SessionGate needs="ready">
      <TripScreen />
    </SessionGate>
  )
}
