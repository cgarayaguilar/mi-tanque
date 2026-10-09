import Box from '@mui/material/Box'
import AutocompleteField from 'components/AutocompleteField'
import { useCreateDialogs } from 'components/CreateDialogs'
import TankFormView, { useTankForm } from 'components/TankForm'
import { equipmentToValue, type FleetTank } from 'schemas/fleet'
import { useFleetStore } from 'store/fleet'
import type { FleetSection } from 'utils/fleetSections'
import { catalogFilterFor } from 'data/truckModels'
import { equipmentWithoutRoom, TANKS_PER_EQUIPMENT } from 'utils/equipmentTanks'
import EditorLayout from './EditorLayout'
import { useSaveFleetItem } from './useSaveFleetItem'

interface Props {
  section: FleetSection
  tank: FleetTank | null
  id: string
  orgId: string
  canWrite: boolean
}

const FORM_ID = 'tank-form'

/** `/flota/tanques/nuevo?equipo=truck:{id}`: the equipment to choose. */
const equipmentInAddress = () => {
  const value = new URLSearchParams(window.location.search).get('equipo')
  return value && /^(truck|trailer):[\w-]+$/.test(value) ? value : null
}

export default function TankEditor({
  section,
  tank,
  id,
  orgId,
  canWrite,
}: Props) {
  const trucks = useFleetStore(state => state.trucks)
  const trailers = useFleetStore(state => state.trailers)
  const tanks = useFleetStore(state => state.tanks)
  const saveItem = useSaveFleetItem(section)
  const tankForm = useTankForm({
    tank,
    // "Agregar tanque" of an equipment brings it chosen (specs/0031 RF-4)
    ...(tank === null && {
      defaults: { equipment: equipmentInAddress() ?? 'none' },
    }),
    disabled: !canWrite,
  })
  const {
    form: {
      control,
      setValue,
      setError,
      formState: { errors, isSubmitting },
    },
    values,
  } = tankForm
  // "+ Crear camión" and "+ Crear remolque" in "Pertenece a" (specs/0031)
  const { create, dialog } = useCreateDialogs(orgId)

  const onSubmit = tankForm.submit((fields, formValues) => {
    // Up to 2 tanks for each truck or trailer (specs/0032 RF-6); an
    // archived one takes no room until it is restored (audit 2026-10-09)
    const full = tank?.archived
      ? null
      : equipmentWithoutRoom(formValues.equipment, id, {
          trucks,
          trailers,
          tanks,
        })
    if (full) {
      setError(
        'equipment',
        { message: `${full} ya tiene ${String(TANKS_PER_EQUIPMENT)} tanques` },
        { shouldFocus: true }
      )
      return
    }
    saveItem(
      {
        id,
        orgId,
        archived: tank?.archived ?? false,
        photoPath: tank?.photoPath ?? null,
        lastMeasurement: tank?.lastMeasurement ?? null,
        ...fields,
      },
      fields,
      tank === null
    )
  })

  // The catalog opens on the tank's truck (specs/0016 RF-6, RF-7)
  const ownerTruck = values.equipment.startsWith('truck:')
    ? trucks.find(truck => `truck:${truck.id}` === values.equipment)
    : undefined
  const truckFilter = ownerTruck
    ? catalogFilterFor(ownerTruck.brand, ownerTruck.model, ownerTruck.year)
    : null

  const isCurrent = (kind: string, itemId: string) =>
    tank?.equipment.kind === kind && tank.equipment.id === itemId
  const equipmentOptions = [
    { value: 'none', label: 'Tanque individual (sin equipo)' },
    ...trucks
      .filter(truck => !truck.archived || isCurrent('truck', truck.id))
      .map(truck => ({
        value: `truck:${truck.id}`,
        label: `Camión · ${truck.name}`,
      })),
    ...trailers
      .filter(trailer => !trailer.archived || isCurrent('trailer', trailer.id))
      .map(trailer => ({
        value: `trailer:${trailer.id}`,
        label: `Remolque · ${trailer.name}`,
      })),
  ]

  return (
    <EditorLayout
      section={section}
      item={tank}
      id={id}
      canWrite={canWrite}
      formId={FORM_ID}
      saving={isSubmitting}
      // Restored, it would make a third one (audit 2026-10-09)
      restoreIssue={() => {
        if (!tank) return null
        const full = equipmentWithoutRoom(
          equipmentToValue(tank.equipment),
          tank.id,
          { trucks, trailers, tanks }
        )
        return full
          ? `${full} ya tiene ${String(TANKS_PER_EQUIPMENT)} tanques. Quítale uno o cambia este de equipo.`
          : null
      }}
    >
      <Box
        component="form"
        id={FORM_ID}
        noValidate
        aria-label="Datos del tanque"
        onSubmit={event => {
          void onSubmit(event)
        }}
      >
        <TankFormView
          tankForm={tankForm}
          truckFilter={truckFilter}
          disabled={!canWrite}
          equipmentField={
            <AutocompleteField
              id="equipment"
              label="Pertenece a"
              options={equipmentOptions}
              error={errors.equipment?.message}
              control={control}
              name="equipment"
              disabled={!canWrite}
              create={[
                {
                  label: 'Crear camión',
                  onCreate: text => {
                    create('truck', text, truckId => {
                      setValue('equipment', `truck:${truckId}`)
                    })
                  },
                },
                {
                  label: 'Crear remolque',
                  onCreate: text => {
                    create('trailer', text, trailerId => {
                      setValue('equipment', `trailer:${trailerId}`)
                    })
                  },
                },
              ]}
            />
          }
        />
      </Box>
      {dialog}
    </EditorLayout>
  )
}
