import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import ColorField from 'components/ColorField'
import MoreDetails, {
  countFilled,
  useMoreDetails,
} from 'components/MoreDetails'
import NumberField from 'components/NumberField'
import AutocompleteField from 'components/AutocompleteField'
import TextField from 'components/TextField'
import {
  truckFormSchema,
  truckFromForm,
  truckToForm,
  type Truck,
  type TruckFormValues,
} from 'schemas/fleet'
import { useDistanceUnit } from 'hooks/useDistanceUnit'
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

// Behind "Ver más detalles" (backend specs/0009 RF-7)
const DETAILS = [
  'efficiency',
  'odometer',
  'assignedDriverUid',
  'vin',
  'description',
] as const

export default function TruckEditor({
  section,
  truck,
  id,
  orgId,
  canWrite,
}: Props) {
  const members = useFleetStore(state => state.members)
  const saveItem = useSaveFleetItem(section)
  // Typed and shown in the organization's unit (backend specs/0010 RF-4)
  const unit = useDistanceUnit()
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<TruckFormValues>({
    resolver: zodResolver(truckFormSchema),
    defaultValues: truckToForm(truck, unit),
    disabled: !canWrite,
  })
  const values = useWatch({ control })
  const details = useMoreDetails<TruckFormValues>(DETAILS, setFocus)

  const onSubmit = (values: TruckFormValues) => {
    // A driver who left the organization: the rules refuse any edit that
    // keeps them, so the truck is left unassigned (audit 2026-10-01). Only
    // with the members loaded, or a real driver would be dropped
    const gone =
      members.length > 0 &&
      values.assignedDriverUid !== '' &&
      !members.some(member => member.uid === values.assignedDriverUid)
    const fields = truckFromForm(
      gone ? { ...values, assignedDriverUid: '' } : values,
      unit
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
          void handleSubmit(onSubmit, details.onInvalid)(event)
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
            label="Placa (opcional)"
            placeholder="M 123-456"
            error={errors.plate?.message}
            registration={register('plate')}
          />
          <Stack direction="row" spacing={3}>
            <TextField
              id="brand"
              label="Marca (opcional)"
              placeholder="Freightliner"
              error={errors.brand?.message}
              registration={register('brand')}
            />
            <TextField
              id="model"
              label="Modelo (opcional)"
              placeholder="Cascadia"
              error={errors.model?.message}
              registration={register('model')}
            />
          </Stack>
          <TextField
            id="year"
            label="Año (opcional)"
            placeholder="2019"
            inputMode="numeric"
            maxLength={4}
            error={errors.year?.message}
            registration={register('year')}
          />
          <ColorField
            control={control}
            swatchName="colorSwatch"
            isOther={values.colorSwatch === 'other'}
            otherRegistration={register('colorOther')}
            otherError={errors.colorOther?.message}
            disabled={!canWrite}
          />
          <MoreDetails
            open={details.open}
            onToggle={details.toggle}
            filled={countFilled([
              values.efficiency,
              values.odometer,
              values.assignedDriverUid,
              values.vin,
              values.description,
            ])}
          >
            <NumberField
              id="efficiency"
              label="Rendimiento (opcional)"
              unit={`${unit}/gal`}
              placeholder="Ej. 6.5"
              hint="Para estimar cuánto puedes recorrer con el combustible."
              error={errors.efficiency?.message}
              registration={register('efficiency')}
            />
            <NumberField
              id="odometer"
              label="Odómetro (opcional)"
              unit={unit}
              placeholder="Ej. 120000"
              hint={`El ${unit === 'mi' ? 'millaje' : 'kilometraje'} actual. La unidad se cambia en Mi cuenta.`}
              error={errors.odometer?.message}
              registration={register('odometer')}
            />
            <AutocompleteField
              id="assignedDriverUid"
              label="Chofer asignado (opcional)"
              options={driverOptions}
              control={control}
              name="assignedDriverUid"
              disabled={!canWrite}
            />
            <TextField
              id="vin"
              label="VIN o número de serie (opcional)"
              error={errors.vin?.message}
              registration={register('vin')}
            />
            <TextField
              id="description"
              label="Descripción (opcional)"
              placeholder="Notas para tu equipo"
              error={errors.description?.message}
              registration={register('description')}
            />
          </MoreDetails>
        </Stack>
      </Box>
    </EditorLayout>
  )
}
