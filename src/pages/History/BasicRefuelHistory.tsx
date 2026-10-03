import { useState } from 'react'
import { sileo } from 'sileo'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import EmptyState from 'components/EmptyState'
import RefuelList, {
  RefuelPeriodSummary,
  type RefuelItem,
} from 'components/RefuelList'
import { useLoad } from 'hooks/useLoad'
import {
  deleteLocalRefuel,
  readLocalRefuelsInPeriod,
  updateLocalRefuel,
} from 'services/localRefuels'
import { readTanks } from 'services/tanks'
import { radius } from 'theme/tokens'
import type { Period, Tank } from 'types'
import { localGeometry, localScale } from 'utils/fuelReading'
import { reportError } from 'utils/reportError'

const tankName = (tank: Tank | undefined) =>
  tank ? `Tanque de ${String(tank.capacity)} gal` : 'Tanque borrado'

/** Refuels on this phone, without an account (backend specs/0006 RF-7–RF-11). */
export default function BasicRefuelHistory({
  period,
  onChangePeriod,
}: {
  period: Period
  onChangePeriod: () => void
}) {
  const [version, setVersion] = useState(0)
  const key = `${String(period.start.getTime())}-${String(period.end.getTime())}-${String(version)}`
  const data = useLoad(key, async () => {
    const [refuels, tanks] = await Promise.all([
      readLocalRefuelsInPeriod(period),
      readTanks(),
    ])
    return { refuels, tanks: new Map(tanks.map(tank => [tank.id, tank])) }
  })
  const reload = () => {
    setVersion(value => value + 1)
  }

  if (data.value === undefined) {
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
  const { refuels, tanks } = data.value
  if (refuels.length === 0) {
    return (
      <EmptyState
        headingLevel="h2"
        icon={<LocalGasStationIcon />}
        title="Sin rellenos en este periodo"
        description="Registra uno en Medición → Rellenar, o elige otro periodo."
        action={{ label: 'Cambiar periodo', onClick: onChangePeriod }}
      />
    )
  }

  const items: RefuelItem[] = refuels.map(refuel => ({
    ...refuel,
    id: String(refuel.id),
    takenAt: new Date(refuel.date),
    tankName: tankName(tanks.get(refuel.tankId)),
    equipmentName: null,
    userName: null,
    place: null,
    odometerKm: null,
    invoice: null,
  }))
  const localOf = (item: RefuelItem) =>
    refuels.find(refuel => String(refuel.id) === item.id)

  return (
    <Stack spacing={4}>
      <RefuelPeriodSummary items={items} efficiency={[]} />
      <RefuelList
        items={items}
        canChange={() => true}
        contextFor={item => {
          const tank = tanks.get(localOf(item)?.tankId ?? -1)
          return tank
            ? {
                geometry: localGeometry(tank),
                scale: localScale(tank),
                maxInches: tank.diameter,
                capacityGal: tank.capacity,
                odometer: null,
              }
            : null
        }}
        onEdit={(item, { values }) => {
          updateLocalRefuel(Number(item.id), values).then(
            () => {
              sileo.success({ title: 'Relleno corregido' })
              reload()
            },
            (error: unknown) => {
              reportError(error, { operation: 'updateLocalRefuel' })
              sileo.error({
                title: 'No pudimos guardar el cambio',
                description: 'Vuelve a intentarlo.',
              })
            }
          )
        }}
        onDelete={item => {
          deleteLocalRefuel(Number(item.id)).then(
            () => {
              sileo.success({ title: 'Relleno borrado' })
              reload()
            },
            (error: unknown) => {
              reportError(error, { operation: 'deleteLocalRefuel' })
              sileo.error({
                title: 'No pudimos borrar el relleno',
                description: 'Vuelve a intentarlo.',
              })
            }
          )
        }}
      />
    </Stack>
  )
}
