import { sileo } from 'sileo'
import type { Client } from 'schemas/clients'
import type { Driver } from 'schemas/drivers'
import type { Rate } from 'schemas/rates'
import type { FleetTank, Trailer, Truck } from 'schemas/fleet'
// Only lazy pages and their dialogs use this hook: the SDK stays out of the
// basic mode's bundle
import {
  createFleetItem,
  updateFleetItem,
  type FleetCollection,
} from 'services/fleet'
import { useFleetStore } from 'store/fleet'
import { recoverFromLostPermission } from 'store/session'
import { sectionWords, type FleetSection } from 'utils/fleetSections'
import { reportError } from 'utils/reportError'

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1)

/**
 * Saves a fleet item the offline way (ADR 0003): it shows at once, the toast
 * says if it waits for signal, and a later rejection by the rules is
 * reported. Flota's screens and the "+ Crear …" dialogs (specs/0028) share it.
 */
export const useCreateFleetItem = (section: FleetSection) => {
  const save = useFleetStore(state => state.save)

  return (
    item: Truck | Trailer | FleetTank | Client | Driver | Rate,
    fields: object,
    isNew: boolean,
    /** Without its own toast: a truck's tanks go with "Camión guardado". */
    quiet = false
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
        title: `No pudimos guardar ${sectionWords(section).the} ${section.one} ${item.name}`,
        description: 'Revisa los datos y vuelve a intentarlo.',
      })
    })
    if (quiet) return
    sileo.success({
      title: `${capitalize(section.one)} guardad${sectionWords(section).it}`,
      ...(!navigator.onLine && {
        description: 'Se subirá cuando tengas señal.',
      }),
    })
  }
}
