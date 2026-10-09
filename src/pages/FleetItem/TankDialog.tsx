import CreateDialog from 'components/CreateDialogs/CreateDialog'
import TankFormView, {
  useTankForm,
  type TankFormFields,
} from 'components/TankForm'
import type { FleetTank, TankEquipment } from 'schemas/fleet'

interface TankDialogProps {
  /** The tank being edited (saved or not yet), or null for a new one. */
  tank: FleetTank | null
  /** The truck or trailer it belongs to: not chosen here. */
  equipment: TankEquipment
  /** The catalog opens on the truck's brand and model (specs/0016). */
  truckFilter: { brand: string; model: string | null } | null
  onSave: (fields: TankFormFields) => void
  onClose: () => void
}

/**
 * "Nuevo tanque" of a truck or a trailer (backend specs/0032 RF-4): the
 * tank's fields but "Pertenece a". It only changes the equipment's form,
 * which saves it.
 */
export default function TankDialog({
  tank,
  equipment,
  truckFilter,
  onSave,
  onClose,
}: TankDialogProps) {
  const tankForm = useTankForm({ tank })

  return (
    <CreateDialog
      title={tank ? 'Editar tanque' : 'Nuevo tanque'}
      formId="equipment-tank"
      saveLabel="Guardar"
      onSubmit={event => {
        void tankForm.submit(fields => {
          onSave({ ...fields, equipment })
          onClose()
        })(event)
      }}
      onClose={onClose}
    >
      <TankFormView
        tankForm={tankForm}
        truckFilter={truckFilter}
        idPrefix="equipment-tank-"
      />
    </CreateDialog>
  )
}
