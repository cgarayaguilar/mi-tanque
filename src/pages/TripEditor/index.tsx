import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import EmptyState from 'components/EmptyState'
import SessionGate from 'components/SessionGate'
import { newTripId } from 'services/trips'
import { useFleetStore } from 'store/fleet'
import { selectActiveRole, useSessionStore } from 'store/session'
import { canWriteFleet } from 'utils/roles'
import { RETRY_HINT } from 'utils/withTimeout'
import { useTrip } from 'hooks/useTrip'
import { useTripExpenses } from 'hooks/useTripExpenses'
import { useExpensesStore } from 'store/expenses'
import TripForm from './TripForm'

function TripEditorScreen() {
  const params = useParams<{ id?: string }>()
  const [, navigate] = useLocation()
  const isNew = params.id === undefined || params.id === 'nuevo'
  // The new trip's id exists from the moment the form opens (ADR 0003)
  const [newId] = useState(newTripId)
  const id = isNew ? newId : (params.id ?? newId)
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const currency = useSessionStore(
    state => state.organization?.defaultCurrency ?? 'USD'
  )
  const role = useSessionStore(selectActiveRole)
  const fleetStatus = useFleetStore(state => state.status)
  const loadFleet = useFleetStore(state => state.load)
  const [loaded, retry] = useTrip(isNew ? null : id)
  // Its expenses are rows of the form (specs/0026 RF-12)
  const [expensesStatus, expenses, retryExpenses] = useTripExpenses(
    orgId,
    isNew ? null : id
  )
  const categoriesStatus = useExpensesStore(state => state.categoriesStatus)
  const loadCategories = useExpensesStore(state => state.loadCategories)
  const back = isNew ? '/viajes' : `/viajes/${id}`

  useEffect(() => {
    if (!orgId) return
    void loadFleet(orgId)
    void loadCategories(orgId)
  }, [orgId, loadFleet, loadCategories])

  const body = () => {
    if (!canWriteFleet(role)) {
      return (
        <EmptyState
          icon={<SearchOffIcon />}
          title="No puedes editar viajes"
          description="Tu rol en la organización es de solo lectura."
          action={{
            label: 'Ver viajes',
            onClick: () => {
              navigate('/viajes')
            },
          }}
        />
      )
    }
    if (!isNew && loaded.status === 'missing') {
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
    }
    if (
      (!isNew && loaded.status === 'error') ||
      expensesStatus === 'error' ||
      categoriesStatus === 'error'
    ) {
      return (
        <EmptyState
          icon={<CloudOffIcon />}
          title="No pudimos cargar el viaje"
          description={RETRY_HINT}
          action={{
            label: 'Reintentar',
            onClick: () => {
              if (loaded.status === 'error') retry()
              if (expensesStatus === 'error') retryExpenses()
              if (categoriesStatus === 'error') void loadCategories(orgId)
            },
          }}
        />
      )
    }
    if (
      fleetStatus !== 'ready' ||
      categoriesStatus !== 'ready' ||
      expensesStatus !== 'ready' ||
      (!isNew && loaded.status !== 'ready')
    ) {
      return (
        <Box aria-busy="true" aria-label="Cargando">
          <Skeleton variant="rounded" height={320} />
        </Box>
      )
    }
    return (
      <TripForm
        key={id}
        trip={loaded.status === 'ready' && !isNew ? loaded.trip : null}
        expenses={isNew ? [] : expenses}
        id={id}
        orgId={orgId}
        currency={currency}
      />
    )
  }

  return (
    <Box component="main" sx={{ px: 4, pt: 2, pb: 8 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => {
          navigate(back)
        }}
        sx={{ ml: -2, mb: 2 }}
      >
        {isNew ? 'Viajes' : 'Viaje'}
      </Button>
      <Typography variant="h3" component="h1" sx={{ mb: 6 }}>
        {isNew ? 'Nuevo viaje' : 'Editar viaje'}
      </Typography>
      {body()}
    </Box>
  )
}

export default function TripEditor() {
  return (
    <SessionGate needs="ready">
      <TripEditorScreen />
    </SessionGate>
  )
}
