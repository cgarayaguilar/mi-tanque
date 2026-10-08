import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import { useLocation, useParams } from 'wouter'
import EmptyState from 'components/EmptyState'
import SessionGate from 'components/SessionGate'
import { newFleetId } from 'services/fleet'
import { useFleetStore } from 'store/fleet'
import { selectActiveRole, useSessionStore } from 'store/session'
import { sectionBySlug } from 'utils/fleetSections'
import { canWriteFleet } from 'utils/roles'
import ClientEditor from './ClientEditor'
import DriverEditor from './DriverEditor'
import TankEditor from './TankEditor'
import TrailerEditor from './TrailerEditor'
import TruckEditor from './TruckEditor'

function FleetItemScreen() {
  const params = useParams<{ section?: string; id?: string }>()
  const section = sectionBySlug(params.section)
  const [, navigate] = useLocation()
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const role = useSessionStore(selectActiveRole)
  const { status, trucks, trailers, tanks, clients, drivers, load } =
    useFleetStore()
  const isNew = params.id === 'nuevo'
  // The new item's id exists from the moment the form opens (ADR 0003)
  const [newId] = useState(newFleetId)
  const id = isNew ? newId : (params.id ?? '')
  const canWrite = canWriteFleet(role)

  useEffect(() => {
    if (orgId) void load(orgId)
  }, [orgId, load])

  if (status !== 'ready' && !isNew) {
    return (
      <Box sx={{ p: 4 }} aria-busy="true" aria-label="Cargando">
        <Skeleton variant="text" width="50%" height={40} />
        <Skeleton variant="rounded" height={240} sx={{ mt: 6 }} />
      </Box>
    )
  }

  const props = { section, id, orgId, canWrite }
  const notFound = (
    <EmptyState
      icon={<SearchOffIcon />}
      title={`No encontramos ese ${section.one}`}
      description="Puede que lo hayan archivado o que pertenezca a otra organización."
      action={{
        label: `Ver ${section.label.toLowerCase()}`,
        onClick: () => {
          navigate(`/flota/${section.slug}`)
        },
      }}
    />
  )

  if (isNew && !canWrite) return notFound

  switch (section.collection) {
    case 'trucks': {
      const truck = isNew ? null : trucks.find(item => item.id === id)
      return truck === undefined ? (
        notFound
      ) : (
        <TruckEditor key={id} {...props} truck={truck} />
      )
    }
    case 'trailers': {
      const trailer = isNew ? null : trailers.find(item => item.id === id)
      return trailer === undefined ? (
        notFound
      ) : (
        <TrailerEditor key={id} {...props} trailer={trailer} />
      )
    }
    case 'tanks': {
      const tank = isNew ? null : tanks.find(item => item.id === id)
      return tank === undefined ? (
        notFound
      ) : (
        <TankEditor key={id} {...props} tank={tank} />
      )
    }
    case 'clients': {
      const client = isNew ? null : clients.find(item => item.id === id)
      return client === undefined ? (
        notFound
      ) : (
        <ClientEditor key={id} {...props} client={client} />
      )
    }
    case 'drivers': {
      const driver = isNew ? null : drivers.find(item => item.id === id)
      return driver === undefined ? (
        notFound
      ) : (
        <DriverEditor key={id} {...props} driver={driver} />
      )
    }
  }
}

export default function FleetItem() {
  return (
    <SessionGate needs="ready">
      <FleetItemScreen />
    </SessionGate>
  )
}
