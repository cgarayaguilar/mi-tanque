import { useRef, useState } from 'react'
import { sileo } from 'sileo'
import {
  addMeasurementLocation,
  createCloudMeasurement,
  type MeasurementEquipment,
} from 'services/cloudMeasurements'
import type { FleetTank } from 'schemas/fleet'
import { recoverFromLostPermission, useSessionStore } from 'store/session'
import { getCurrentPosition } from 'utils/getCurrentPosition'
import type { CloudReading } from 'utils/measurementMath'
import { reportError } from 'utils/reportError'
import { authorName } from 'utils/personName'

/**
 * Saves a fleet tank's measurement (backend specs/0004 RF-4, RF-5): written
 * at once with the intent id (offline too), the location added when the GPS
 * answers, and a late rejection by the rules reported to the user.
 */
export const useSaveCloudMeasurement = (
  equipmentName: (tank: FleetTank) => string | null
) => {
  const user = useSessionStore(state => state.user)
  const orgId = useSessionStore(state => state.organization?.id ?? null)
  const userName = useSessionStore(
    state => state.profile?.displayName ?? state.user?.displayName ?? ''
  )
  // One id per measurement: a retry of the same save cannot duplicate it
  const [intentId, setIntentId] = useState(() => crypto.randomUUID())
  const savingRef = useRef(false)

  return (
    tank: FleetTank,
    reading: CloudReading,
    odometerKm: number | null
  ) => {
    if (savingRef.current || !user || !orgId) return
    savingRef.current = true
    const id = intentId
    const equipment: MeasurementEquipment =
      tank.equipment.kind === 'none'
        ? { kind: 'none', id: null, name: null }
        : {
            kind: tank.equipment.kind,
            id: tank.equipment.id,
            name: equipmentName(tank) ?? '',
          }

    createCloudMeasurement({
      id,
      orgId,
      tankId: tank.id,
      tankName: tank.name,
      equipment,
      userId: user.uid,
      userName: authorName(userName),
      takenAt: new Date(),
      reading,
      odometerKm,
    }).catch((error: unknown) => {
      reportError(error, { operation: 'createCloudMeasurement' })
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: 'No pudimos guardar la medición',
        description: 'Revisa los datos y vuelve a intentarlo.',
      })
    })

    sileo.success({
      title: 'Medición guardada',
      ...(!navigator.onLine && {
        description: 'Se subirá cuando tengas señal.',
      }),
    })
    setIntentId(crypto.randomUUID())
    savingRef.current = false

    // The location is optional and may take a while: never hold the save
    getCurrentPosition()
      .then(position =>
        position ? addMeasurementLocation(id, user.uid, position) : undefined
      )
      .catch((error: unknown) => {
        reportError(error, { operation: 'addMeasurementLocation' })
      })
  }
}
