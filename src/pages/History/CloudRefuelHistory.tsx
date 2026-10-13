import { useEffect, useState } from 'react'
import { sileo } from 'sileo'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import EmptyState from 'components/EmptyState'
import TripLinkPicker from 'components/TripLinkPicker'
import { NO_TRIP, type TripLink } from 'schemas/tripLink'
import { readExpense } from 'services/expenses'
import RefuelList, {
  RefuelPeriodSummary,
  type RefuelItem,
  type TruckEfficiencyRow,
} from 'components/RefuelList'
import {
  deleteCloudRefuel,
  invoiceUrl,
  updateCloudRefuel,
  type CloudRefuel,
} from 'services/cloudRefuels'
import { useCloudRefuelsStore } from 'store/cloudRefuels'
import { useFleetStore } from 'store/fleet'
import {
  recoverFromLostPermission,
  selectActiveRole,
  useSessionStore,
} from 'store/session'
import { radius } from 'theme/tokens'
import type { FleetTank } from 'schemas/fleet'
import type { Period } from 'types'
import {
  capacityScaleOf,
  geometryOf,
  maxInchesFor,
} from 'utils/measurementMath'
import { declaredEfficiency } from 'utils/fleetLabels'
import { truckEfficiency, truckTotals } from 'utils/refuelMath'
import { reportError } from 'utils/reportError'
import { canChangeReading } from 'utils/roles'
import { useFormDistanceUnit } from 'hooks/useDistanceUnit'
import { RETRY_HINT } from 'utils/withTimeout'

const placeText = (refuel: CloudRefuel): string | null => {
  if (refuel.place) {
    return [refuel.place.city, refuel.place.state, refuel.place.country]
      .filter((part, index, parts) => part && parts.indexOf(part) === index)
      .join(', ')
  }
  if (refuel.location && refuel.placeStatus === null)
    return 'Buscando el lugar…'
  return null
}

/** The organization's refuels in the period (backend specs/0006 RF-7–RF-11). */
export default function CloudRefuelHistory({
  period,
  equipmentId,
  tripId,
  onChangePeriod,
}: {
  period: Period
  equipmentId: string | null
  /** Only one trip's (backend specs/0042 RF-8). */
  tripId: string | null
  onChangePeriod: () => void
}) {
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const organizationCurrency = useSessionStore(
    state => state.organization?.defaultCurrency
  )
  const uid = useSessionStore(state => state.user?.uid)
  const role = useSessionStore(selectActiveRole)
  const refuels = useCloudRefuelsStore()
  const { trucks, tanks } = useFleetStore()
  const distanceUnit = useFormDistanceUnit()
  const { load } = refuels

  // By value: the parent builds a new period object on every render
  const startMs = period.start.getTime()
  const endMs = period.end.getTime()
  useEffect(() => {
    if (!orgId) return
    void load({
      orgId,
      period: { start: new Date(startMs), end: new Date(endMs) },
      equipmentId,
      tripId,
    })
  }, [orgId, startMs, endMs, equipmentId, tripId, load])

  if (refuels.status === 'error' && refuels.items.length === 0) {
    return (
      <EmptyState
        headingLevel="h2"
        icon={<CloudOffIcon />}
        title="No pudimos cargar los rellenos"
        description={RETRY_HINT}
        action={{
          label: 'Reintentar',
          onClick: () =>
            void load({ orgId, period, equipmentId, tripId }, { force: true }),
        }}
      />
    )
  }
  if (refuels.status !== 'ready' && refuels.items.length === 0) {
    return (
      <Stack spacing={4} aria-busy="true" aria-label="Cargando rellenos">
        <Skeleton
          variant="rounded"
          height={120}
          sx={{ borderRadius: `${String(radius.xl)}px` }}
        />
        <Skeleton
          variant="rounded"
          height={120}
          sx={{ borderRadius: `${String(radius.xl)}px` }}
        />
      </Stack>
    )
  }
  if (refuels.items.length === 0) {
    return (
      <EmptyState
        headingLevel="h2"
        icon={<LocalGasStationIcon />}
        title="Sin rellenos en este periodo"
        description="Registra uno en Medición → Rellenar, o elige otro periodo, equipo o viaje."
        action={{ label: 'Cambiar periodo', onClick: onChangePeriod }}
      />
    )
  }

  const byId = new Map(refuels.items.map(refuel => [refuel.id, refuel]))
  const items: RefuelItem[] = refuels.items.map(refuel => {
    const path = refuel.invoicePhotoPath
    return {
      ...refuel,
      equipmentName: refuel.equipment.name,
      place: placeText(refuel),
      trip: refuel.tripRoute,
      invoice: path ? () => invoiceUrl(path) : null,
    }
  })

  // Real efficiency per truck, by levels (RF-9)
  const perTruck = new Map<string, CloudRefuel[]>()
  for (const refuel of refuels.items) {
    if (refuel.equipment.kind !== 'truck' || refuel.equipment.id === null)
      continue
    const list = perTruck.get(refuel.equipment.id) ?? []
    list.push(refuel)
    perTruck.set(refuel.equipment.id, list)
  }
  const efficiency: TruckEfficiencyRow[] = [...perTruck.entries()].flatMap(
    ([truckId, list]) => {
      const result = truckEfficiency(list)
      if (!result) return []
      const truck = trucks.find(item => item.id === truckId)
      return [
        {
          truckName: truck?.name ?? list[0]?.equipment.name ?? 'Camión',
          km: result.km,
          gallons: result.gallons,
          unit: distanceUnit,
          declared: truck ? declaredEfficiency(truck, distanceUnit) : null,
        },
      ]
    }
  )

  const truckOf = (tank: FleetTank) =>
    tank.equipment.kind === 'truck'
      ? trucks.find(candidate => candidate.id === tank.equipment.id)
      : undefined

  return (
    <Stack spacing={4}>
      <RefuelPeriodSummary items={items} efficiency={efficiency} />
      <RefuelList
        items={items}
        organizationCurrency={organizationCurrency}
        canChange={item => {
          const refuel = byId.get(item.id)
          return refuel !== undefined && canChangeReading(refuel, role, uid)
        }}
        contextFor={item => {
          const refuel = byId.get(item.id)
          const tank = tanks.find(candidate => candidate.id === refuel?.tankId)
          if (!tank) return null
          const truck = truckOf(tank)
          return {
            geometry: geometryOf(tank),
            scale: capacityScaleOf(tank),
            maxInches: maxInchesFor(tank),
            capacityGal: tank.capacityGal,
            odometer: truck
              ? { unit: distanceUnit, truckName: truck.name }
              : null,
          }
        }}
        editTrip={(item, onChange) => {
          const refuel = byId.get(item.id)
          const tank = tanks.find(candidate => candidate.id === refuel?.tankId)
          return refuel ? (
            <RefuelTrip
              refuel={refuel}
              orgId={orgId}
              equipment={tank?.equipment ?? refuel.equipment}
              onChange={onChange}
            />
          ) : null
        }}
        onEdit={(item, { values, odometerKm }, trip) => {
          const refuel = byId.get(item.id)
          if (!refuel || !uid) return
          // The truck's other tanks did not change: keep their share (RF-9)
          const rest =
            refuel.truckGallonsBefore !== null && refuel.gallonsBefore !== null
              ? refuel.truckGallonsBefore - refuel.gallonsBefore
              : null
          const totals =
            refuel.equipment.kind === 'truck'
              ? truckTotals(values, [rest])
              : { truckGallonsBefore: null, truckGallonsAfter: null }
          // Without a truck the form does not ask the odometer: keep the one
          // saved instead of erasing it (audit 2026-10-01)
          const tank = tanks.find(candidate => candidate.id === refuel.tankId)
          const edit = {
            values,
            totals,
            odometerKm: tank && truckOf(tank) ? odometerKm : refuel.odometerKm,
            trip,
          }
          refuels.applyEdit(refuel.id, edit)
          updateCloudRefuel(refuel.id, uid, edit).catch((error: unknown) => {
            reportError(error, { operation: 'updateCloudRefuel' })
            if (recoverFromLostPermission(error)) return
            sileo.error({
              title: 'No pudimos guardar el cambio',
              description: 'Revisa los datos y vuelve a intentarlo.',
            })
          })
          sileo.success({ title: 'Relleno corregido' })
        }}
        onDelete={item => {
          refuels.remove(item.id)
          deleteCloudRefuel(item.id).catch((error: unknown) => {
            reportError(error, { operation: 'deleteCloudRefuel' })
            if (recoverFromLostPermission(error)) return
            sileo.error({
              title: 'No pudimos borrar el relleno',
              description: 'Vuelve a intentarlo.',
            })
          })
          sileo.success({ title: 'Relleno borrado' })
        }}
      />
      {refuels.cursor && (
        <Button
          variant="outlined"
          loading={refuels.loadingMore}
          onClick={() => {
            refuels.loadMore().catch(() => {
              sileo.error({
                title: 'No pudimos cargar más rellenos',
                description: 'Revisa tu conexión.',
              })
            })
          }}
        >
          Ver más
        </Button>
      )}
    </Stack>
  )
}

/**
 * A refuel's trip when correcting it (backend specs/0042 RF-3). One from
 * before says none: its trip is its expense's, read first. If the expense
 * cannot be read, the field stays out and the correction keeps the link.
 */
function RefuelTrip({
  refuel,
  orgId,
  equipment,
  onChange,
}: {
  refuel: CloudRefuel
  orgId: string
  equipment: CloudRefuel['equipment'] | FleetTank['equipment']
  onChange: (trip: TripLink | undefined) => void
}) {
  const [fromExpense, setFromExpense] = useState<TripLink | null | undefined>(
    refuel.tripChosen ? null : undefined
  )
  useEffect(() => {
    if (refuel.tripChosen) return
    let current = true
    readExpense(refuel.id)
      .then(expense => {
        if (current)
          setFromExpense(
            expense?.kind === 'trip'
              ? { tripId: expense.tripId, tripRoute: expense.tripRoute }
              : NO_TRIP
          )
      })
      .catch((error: unknown) => {
        reportError(error, { operation: 'readRefuelExpenseTrip' })
        if (current) setFromExpense(null)
      })
    return () => {
      current = false
    }
  }, [refuel.id, refuel.tripChosen])

  if (!refuel.tripChosen && fromExpense === undefined)
    return <Skeleton variant="rounded" height={56} />
  // From before, and its expense could not be read: left as it is
  if (!refuel.tripChosen && fromExpense === null) return null
  return (
    <TripLinkPicker
      id="editRefuelTrip"
      orgId={orgId}
      equipment={equipment}
      at={refuel.takenAt}
      saved={
        refuel.tripChosen
          ? { tripId: refuel.tripId, tripRoute: refuel.tripRoute }
          : (fromExpense ?? NO_TRIP)
      }
      onChange={onChange}
    />
  )
}
