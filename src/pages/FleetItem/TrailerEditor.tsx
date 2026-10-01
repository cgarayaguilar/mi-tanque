import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import ColorField from 'components/ColorField'
import NumberField from 'components/NumberField'
import SelectField from 'components/SelectField'
import TextField from 'components/TextField'
import {
  TRAILER_TYPES,
  trailerFormSchema,
  trailerFromForm,
  trailerToForm,
  type Trailer,
  type TrailerFormValues,
} from 'schemas/fleet'
import { useFleetStore } from 'store/fleet'
import type { FleetSection } from 'utils/fleetSections'
import EditorLayout from './EditorLayout'
import { useSaveFleetItem } from './useSaveFleetItem'

interface Props {
  section: FleetSection
  trailer: Trailer | null
  id: string
  orgId: string
  canWrite: boolean
}

const FORM_ID = 'trailer-form'

export default function TrailerEditor({
  section,
  trailer,
  id,
  orgId,
  canWrite,
}: Props) {
  const trucks = useFleetStore(state => state.trucks)
  const saveItem = useSaveFleetItem(section)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TrailerFormValues>({
    resolver: zodResolver(trailerFormSchema),
    defaultValues: trailerToForm(trailer),
    disabled: !canWrite,
  })
  const trailerType = useWatch({ control, name: 'trailerType' })

  const onSubmit = (values: TrailerFormValues) => {
    const fields = trailerFromForm(values)
    saveItem(
      {
        id,
        orgId,
        archived: trailer?.archived ?? false,
        photoPath: trailer?.photoPath ?? null,
        ...fields,
      },
      fields,
      trailer === null
    )
  }

  // Archived trucks are not offered, unless this trailer is still hitched to one
  const truckOptions = [
    { value: '', label: 'Sin enganchar' },
    ...trucks
      .filter(truck => !truck.archived || truck.id === trailer?.hitchedTruckId)
      .map(truck => ({ value: truck.id, label: truck.name })),
  ]

  return (
    <EditorLayout
      section={section}
      item={trailer}
      id={id}
      canWrite={canWrite}
      formId={FORM_ID}
      saving={isSubmitting}
    >
      <Box
        component="form"
        id={FORM_ID}
        noValidate
        aria-label="Datos del remolque"
        onSubmit={event => {
          void handleSubmit(onSubmit)(event)
        }}
      >
        <Stack spacing={5}>
          <TextField
            id="name"
            label="Nombre o número de unidad"
            placeholder="Caja 7"
            error={errors.name?.message}
            registration={register('name')}
          />
          <SelectField
            id="trailerType"
            label="Tipo de remolque"
            options={TRAILER_TYPES.map(type => ({
              value: type.id,
              label: type.label,
            }))}
            registration={register('trailerType')}
          />
          {trailerType === 'other' && (
            <TextField
              id="trailerTypeOther"
              label="¿Qué tipo?"
              placeholder="Jaula ganadera"
              error={errors.trailerTypeOther?.message}
              registration={register('trailerTypeOther')}
            />
          )}
          <SelectField
            id="hitchedTruckId"
            label="Enganchado a"
            options={truckOptions}
            hint="De este camión sale el rendimiento para estimar distancias."
            registration={register('hitchedTruckId')}
          />
          {trailerType === 'reefer' && (
            <NumberField
              id="reeferConsumption"
              label="Consumo del equipo de frío"
              unit="gal/h"
              placeholder="Ej. 0,8"
              hint="Galones por hora del termo."
              error={errors.reeferConsumption?.message}
              registration={register('reeferConsumption')}
            />
          )}
          <NumberField
            id="lengthFt"
            label="Largo"
            unit="pies"
            placeholder="Ej. 53"
            hint="Entre 10 y 60 pies."
            error={errors.lengthFt?.message}
            registration={register('lengthFt')}
          />
          <TextField
            id="plate"
            label="Placa"
            error={errors.plate?.message}
            registration={register('plate')}
          />
          <Stack direction="row" spacing={3}>
            <TextField
              id="brand"
              label="Marca"
              placeholder="Utility"
              error={errors.brand?.message}
              registration={register('brand')}
            />
            <TextField
              id="model"
              label="Modelo"
              placeholder="3000R"
              error={errors.model?.message}
              registration={register('model')}
            />
          </Stack>
          <TextField
            id="year"
            label="Año"
            placeholder="2018"
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
          <TextField
            id="vin"
            label="VIN o número de serie"
            error={errors.vin?.message}
            registration={register('vin')}
          />
          <TextField
            id="description"
            label="Descripción"
            error={errors.description?.message}
            registration={register('description')}
          />
        </Stack>
      </Box>
    </EditorLayout>
  )
}
