import { useRef, useState } from 'react'
import { sileo } from 'sileo'
import type { RefuelResult } from 'components/RefuelForm'
import type { MeasurementEquipment } from 'services/cloudMeasurements'
import {
  addRefuelLocation,
  createCloudRefuel,
  type TruckTotals,
} from 'services/cloudRefuels'
import { enqueueInvoice, processInvoiceQueue } from 'services/invoiceQueue'
import type { FleetTank } from 'schemas/fleet'
import { recoverFromLostPermission, useSessionStore } from 'store/session'
import { getCurrentPosition } from 'utils/getCurrentPosition'
import { reportError } from 'utils/reportError'

/**
 * Saves a refuel of a fleet tank (backend specs/0006 RF-4, RF-6): written
 * at once with the intent id (offline too), the location added when the GPS
 * answers, and the invoice queued until there is a connection.
 */
export const useSaveCloudRefuel = (
  equipmentName: (tank: FleetTank) => string | null
) => {
  const user = useSessionStore(state => state.user)
  const orgId = useSessionStore(state => state.organization?.id ?? null)
  const userName = useSessionStore(
    state => state.profile?.displayName ?? state.user?.displayName ?? ''
  )
  const [intentId, setIntentId] = useState(() => crypto.randomUUID())
  const savingRef = useRef(false)

  return (tank: FleetTank, result: RefuelResult, totals: TruckTotals) => {
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

    createCloudRefuel({
      id,
      orgId,
      tankId: tank.id,
      tankName: tank.name,
      equipment,
      userId: user.uid,
      userName: userName || 'Sin nombre',
      takenAt: new Date(),
      values: result.values,
      totals,
      odometerKm: result.odometerKm,
    }).catch((error: unknown) => {
      reportError(error, { operation: 'createCloudRefuel' })
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: 'No pudimos guardar el relleno',
        description: 'Revisa los datos y vuelve a intentarlo.',
      })
    })

    sileo.success({
      title: 'Relleno guardado',
      ...(!navigator.onLine && {
        description: 'Se subirá cuando tengas señal.',
      }),
    })
    setIntentId(crypto.randomUUID())
    savingRef.current = false

    if (result.photo) {
      enqueueInvoice({
        refuelId: id,
        orgId,
        uid: user.uid,
        photo: result.photo,
      })
        .then(() => processInvoiceQueue(user.uid))
        .catch((error: unknown) => {
          reportError(error, { operation: 'enqueueInvoice' })
        })
    }

    // The location is optional and may take a while: never hold the save
    getCurrentPosition()
      .then(position =>
        position ? addRefuelLocation(id, user.uid, position) : undefined
      )
      .catch((error: unknown) => {
        reportError(error, { operation: 'addRefuelLocation' })
      })
  }
}
