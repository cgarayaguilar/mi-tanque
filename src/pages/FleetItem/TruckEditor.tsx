import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import ColorField from 'components/ColorField'
import NumberField from 'components/NumberField'
import SelectField from 'components/SelectField'
import TextField from 'components/TextField'
import {
  convertDistanceFields,
  truckFormSchema,
  truckFromForm,
  truckToForm,
  type DistanceUnit,
  type Truck,
  type TruckFormValues,
} from 'schemas/fleet'
import { useFleetStore } from 'store/fleet'
import { ROLE_LABELS } from 'utils/roles'
import type { FleetSection } from 'utils/fleetSections'
import EditorLayout from './EditorLayout'
import { useSaveFleetItem } from './useSaveFleetItem'

interface Props {
  section: FleetSection
  truck: Truck | null
  id: string
  orgId: string
  canWrite: boolean
}

const FORM_ID = 'truck-form'

export default function TruckEditor({
  section,
  truck,
  id,
  orgId,
  canWrite,
}: Props) {
  const members = useFleetStore(state => state.members)
  const saveItem = useSaveFleetItem(section)
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TruckFormValues>({
    resolver: zodResolver(truckFormSchema),
    defaultValues: truckToForm(truck),
    disabled: !canWrite,
  })
  const unit = useWatch({ control, name: 'distanceUnit' })

  const onSubmit = (values: TruckFormValues) => {
    // A driver who left the organization: the rules refuse any edit that
    // keeps them, so the truck is left unassigned (audit 2026-10-01). Only
    // with the members loaded, or a real driver would be dropped
    const gone =
      members.length > 0 &&
      values.assignedDriverUid !== '' &&
      !members.some(member => member.uid === values.assignedDriverUid)
    const fields = truckFromForm(
      gone ? { ...values, assignedDriverUid: '' } : values
    )
    saveItem(
      {
        id,
        orgId,
        archived: truck?.archived ?? false,
        photoPath: truck?.photoPath ?? null,
        ...fields,
      },
      fields,
      truck === null
    )
  }

  const driverOptions = [
    { value: '', label: 'Sin asignar' },
    ...members.map(member => ({
      value: member.uid,
      label: `${member.displayName} (${ROLE_LABELS[member.role]})`,
    })),
  ]

  return (
    <EditorLayout
      section={section}
      item={truck}
      id={id}
      canWrite={canWrite}
      formId={FORM_ID}
      saving={isSubmitting}
    >
      <Box
        component="form"
        id={FORM_ID}
        noValidate
        aria-label="Datos del camión"
        onSubmit={event => {
          void handleSubmit(onSubmit)(event)
        }}
      >
        <Stack spacing={5}>
          <TextField
            id="name"
            label="Nombre o número de unidad"
            placeholder="Unidad 12"
            error={errors.name?.message}
            registration={register('name')}
          />
          <TextField
            id="plate"
            label="Placa"
            placeholder="M 123-456"
            error={errors.plate?.message}
            registration={register('plate')}
          />
          <Stack direction="row" spacing={3}>
            <TextField
              id="brand"
              label="Marca"
              placeholder="Freightliner"
              error={errors.brand?.message}
              registration={register('brand')}
            />
            <TextField
              id="model"
              label="Modelo"
              placeholder="Cascadia"
              error={errors.model?.message}
              registration={register('model')}
            />
          </Stack>
          <TextField
            id="year"
            label="Año"
            placeholder="2019"
            inputMode="numeric"
            maxLength={4}
            error={errors.year?.message}
            registration={register('year')}
          />
          <ColorField
            control={control}
            swatchName="colorSwatch"
            otherRegistration={register('colorOther')}
            otherError={errors.colorOther?.message}
            disabled={!canWrite}
          />
          <SelectField
            id="distanceUnit"
            label="Unidad de distancia"
            options={[
              { value: 'km', label: 'Kilómetros' },
              { value: 'mi', label: 'Millas' },
            ]}
            hint="Para el rendimiento y el odómetro de este camión."
            registration={register('distanceUnit', {
              // The numbers typed follow the unit (`unit` is still the old one)
              onChange: (event: { target: { value: DistanceUnit } }) => {
                const converted = convertDistanceFields(
                  getValues(),
                  unit,
                  event.target.value
                )
                setValue('efficiency', converted.efficiency)
                setValue('odometer', converted.odometer)
              },
            })}
          />
          <NumberField
            id="efficiency"
            label="Rendimiento"
            unit={`${unit}/gal`}
            placeholder="Ej. 6.5"
            hint="Para estimar cuánto puedes recorrer con el combustible."
            error={errors.efficiency?.message}
            registration={register('efficiency')}
          />
          <NumberField
            id="odometer"
            label="Odómetro"
            unit={unit}
            placeholder="Ej. 120000"
            hint="El kilometraje o millaje actual."
            error={errors.odometer?.message}
            registration={register('odometer')}
          />
          <SelectField
            id="assignedDriverUid"
            label="Chofer asignado"
            options={driverOptions}
            registration={register('assignedDriverUid')}
          />
          <TextField
            id="vin"
            label="VIN o número de serie"
            error={errors.vin?.message}
            registration={register('vin')}
          />
          <TextField
            id="description"
            label="Descripción"
            placeholder="Notas para tu equipo"
            error={errors.description?.message}
            registration={register('description')}
          />
        </Stack>
      </Box>
    </EditorLayout>
  )
}
