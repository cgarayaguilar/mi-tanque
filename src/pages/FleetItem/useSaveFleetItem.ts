import { useLocation } from 'wouter'
import { sileo } from 'sileo'
import {
  createFleetItem,
  updateFleetItem,
  type FleetCollection,
} from 'services/fleet'
import type { FleetTank, Trailer, Truck } from 'schemas/fleet'
import { useFleetStore } from 'store/fleet'
import { recoverFromLostPermission } from 'store/session'
import type { FleetSection } from 'utils/fleetSections'
import { reportError } from 'utils/reportError'

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1)

/**
 * Saves a fleet item the offline way (ADR 0003): it shows at once, the toast
 * says if it waits for signal, and a later rejection by the rules is reported.
 */
export const useSaveFleetItem = (section: FleetSection) => {
  const save = useFleetStore(state => state.save)
  const [, navigate] = useLocation()

  return (
    item: Truck | Trailer | FleetTank,
    fields: object,
    isNew: boolean
  ): void => {
    const collection: FleetCollection = section.collection
    const write = () =>
      isNew
        ? createFleetItem(collection, item.id, item.orgId, fields)
        : updateFleetItem(collection, item.id, fields)

    save(collection, item, write).catch((error: unknown) => {
      reportError(error, { operation: 'saveFleetItem', collection })
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: `No pudimos guardar el ${section.one} ${item.name}`,
        description: 'Revisa los datos y vuelve a intentarlo.',
      })
    })
    sileo.success({
      title: `${capitalize(section.one)} guardado`,
      ...(!navigator.onLine && {
        description: 'Se subirá cuando tengas señal.',
      }),
    })
    navigate(`/flota/${section.slug}`)
  }
}
