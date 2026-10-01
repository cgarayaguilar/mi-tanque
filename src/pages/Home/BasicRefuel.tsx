import { useRef, useState } from 'react'
import { sileo } from 'sileo'
import RefuelForm from 'components/RefuelForm'
import RefuelSummary from 'components/RefuelSummary'
import { useLoad } from 'hooks/useLoad'
import {
  createLocalRefuel,
  lastLocalGallons,
  localStations,
} from 'services/localRefuels'
import type { RefuelValues, Tank } from 'types'
import { reportError } from 'utils/reportError'
import type { TankGeometry } from 'utils/tankVolume'

/** A refuel without an account, saved on this phone (backend specs/0006). */
export default function BasicRefuel({ tank }: { tank: Tank }) {
  const [saved, setSaved] = useState<RefuelValues | null>(null)
  const [intentId, setIntentId] = useState(() => crypto.randomUUID())
  const savingRef = useRef(false)
  // Reloaded after each save: the next "before" starts from this one
  const context = useLoad(`${String(tank.id)}|${intentId}`, async () => ({
    lastGallons: await lastLocalGallons(tank.id),
    stations: await localStations(),
  }))
  const geometry: TankGeometry = {
    shape: 'cylinder',
    orientation: 'horizontal',
    dimensions: { diameterIn: tank.diameter, lengthIn: tank.length },
  }

  return (
    <>
      <RefuelForm
        geometry={geometry}
        maxInches={tank.diameter}
        capacityGal={tank.capacity}
        defaultCurrency=""
        lastGallons={context.value?.lastGallons ?? null}
        stations={context.value?.stations ?? []}
        odometer={null}
        allowsPhoto={false}
        canSave
        submitLabel="Guardar relleno"
        onSave={({ values }) => {
          if (savingRef.current) return
          savingRef.current = true
          createLocalRefuel({
            ...values,
            intentId,
            date: new Date(),
            tankId: tank.id,
          })
            .then(
              () => {
                setSaved(values)
                sileo.success({ title: 'Relleno guardado' })
                setIntentId(crypto.randomUUID())
              },
              (error: unknown) => {
                reportError(error, { operation: 'createLocalRefuel' })
                sileo.error({
                  title: 'No pudimos guardar el relleno',
                  description: 'Vuelve a intentarlo.',
                })
              }
            )
            .finally(() => {
              savingRef.current = false
            })
        }}
      />
      {saved && <RefuelSummary values={saved} />}
    </>
  )
}
