import { useState } from 'react'
import RefuelForm from 'components/RefuelForm'
import RefuelSummary from 'components/RefuelSummary'
import { useLoad } from 'hooks/useLoad'
import { useSaveCloudRefuel } from 'hooks/useSaveCloudRefuel'
import type { FleetTank, Truck } from 'schemas/fleet'
import { readStations } from 'services/cloudRefuels'
import { selectActiveRole, useSessionStore } from 'store/session'
import type { RefuelValues } from 'types'
import { geometryOf, maxInchesFor } from 'utils/measurementMath'
import { truckTotals } from 'utils/refuelMath'
import { reportError } from 'utils/reportError'
import { canWriteFleet } from 'utils/roles'
import { useFormDistanceUnit } from 'hooks/useDistanceUnit'

/** A refuel of a fleet tank (backend specs/0006 RF-1–RF-6). */
export default function CloudRefuel({
  tank,
  tanks,
  truck,
  equipmentName,
}: {
  tank: FleetTank
  /** The organization's active tanks: the truck's others add to its total. */
  tanks: readonly FleetTank[]
  /** The truck the tank belongs to, if any (odometer, RF-9). */
  truck: Truck | null
  equipmentName: (tank: FleetTank) => string | null
}) {
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const currency = useSessionStore(
    state => state.organization?.defaultCurrency ?? 'USD'
  )
  const role = useSessionStore(selectActiveRole)
  const distanceUnit = useFormDistanceUnit()
  const save = useSaveCloudRefuel(equipmentName)
  const [saved, setSaved] = useState<RefuelValues | null>(null)
  const stations = useLoad(orgId, () =>
    readStations(orgId).catch((error: unknown) => {
      // Suggestions only: the form works without them
      reportError(error, { operation: 'readStations' })
      return []
    })
  )
  // Other tanks of the same truck, by their latest reading (RF-9)
  const onTruck = tank.equipment.kind === 'truck' ? tank.equipment.id : null
  const otherTanks = onTruck
    ? tanks.filter(
        other =>
          other.id !== tank.id &&
          other.equipment.kind === 'truck' &&
          other.equipment.id === onTruck
      )
    : []

  return (
    <>
      <RefuelForm
        // A save starts a fresh form (new intent, new "before")
        key={`${tank.id}-${String(saved?.gallonsAfter ?? '')}`}
        geometry={geometryOf(tank)}
        maxInches={maxInchesFor(tank)}
        capacityGal={tank.capacityGal}
        defaultCurrency={currency}
        lastGallons={
          saved?.gallonsAfter ?? tank.lastMeasurement?.gallons ?? null
        }
        stations={stations.value ?? []}
        odometer={
          truck && onTruck
            ? { unit: distanceUnit, truckName: truck.name }
            : null
        }
        allowsPhoto
        canSave={canWriteFleet(role)}
        submitLabel="Guardar relleno"
        onSave={result => {
          const totals = onTruck
            ? truckTotals(
                result.values,
                otherTanks.map(other => other.lastMeasurement?.gallons ?? null)
              )
            : { truckGallonsBefore: null, truckGallonsAfter: null }
          save(tank, result, totals)
          setSaved(result.values)
        }}
      />
      {saved && <RefuelSummary values={saved} />}
    </>
  )
}
