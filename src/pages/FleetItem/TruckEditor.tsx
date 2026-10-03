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
import { TRUCK_BRANDS, TRUCK_MODELS } from 'data/truckModels'
import {
  FLEET_LIMITS,
  OTHER_CHOICE,
  truckFormSchema,
  truckFromForm,
  truckToForm,
  type Truck,
  type TruckFormValues,
} from 'schemas/fleet'
import { useFormDistanceUnit } from 'hooks/useDistanceUnit'
import { useFleetStore } from 'store/fleet'
import { ROLE_LABELS } from 'utils/roles'
import type { FleetSection } from 'utils/fleetSections'
import EditorLayout from './EditorLayout'
import { useSaveFleetItem } from './useSaveFleetItem'
import DateField from 'components/DateField'
import InsuranceChip from 'components/InsuranceChip'
import { insuranceNotice } from 'utils/insurance'

interface Props {
  section: FleetSection
  truck: Truck | null
  id: string
  orgId: string
  canWrite: boolean
}

const FORM_ID = 'truck-form'

const BRAND_OPTIONS = [
  { value: '', label: 'Sin marca' },
  ...TRUCK_BRANDS.map(brand => ({ value: brand, label: brand })),
  { value: OTHER_CHOICE, label: 'Otra marca…' },
]

const modelOptions = (brand: string) => [
  { value: '', label: 'Sin modelo' },
  ...(TRUCK_MODELS[brand] ?? []).map(model => ({
    value: model.name,
    label: model.name,
  })),
  { value: OTHER_CHOICE, label: 'Otro modelo…' },
]

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
  const unit = useFormDistanceUnit()
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<TruckFormValues>({
    resolver: zodResolver(truckFormSchema),
    defaultValues: truckToForm(truck, unit),
    disabled: !canWrite,
  })
  const values = useWatch({ control })
  const listedBrand =
    values.brandChoice !== undefined &&
    values.brandChoice !== '' &&
    values.brandChoice !== OTHER_CHOICE
  // The same notice as the fleet card (backend specs/0011 RF-5)
  const notice = truck
    ? insuranceNotice(truck.insuranceExpiresOn, new Date(), truck.archived)
    : null
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
    // Untouched, they keep what is stored: shown rounded in miles, they came
    // back a kilometer off on every save (audit 2026-10-02)
    if (truck && !dirtyFields.odometer) fields.odometerKm = truck.odometerKm
    if (truck && !dirtyFields.efficiency) {
      fields.fuelEfficiencyKmPerGal = truck.fuelEfficiencyKmPerGal
    }
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
          {notice && <InsuranceChip notice={notice} />}
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
          {/* From the list, or "Otra…" and typed (specs/0016 RF-2, RF-3) */}
          <AutocompleteField
            id="brandChoice"
            label="Marca (opcional)"
            placeholder="Elige la marca"
            options={BRAND_OPTIONS}
            control={control}
            name="brandChoice"
            disabled={!canWrite}
            onChange={brand => {
              // A model belongs to one brand
              const models = TRUCK_MODELS[brand] ?? []
              if (!models.some(model => model.name === values.modelChoice))
                setValue('modelChoice', '')
            }}
          />
          {values.brandChoice === OTHER_CHOICE && (
            <TextField
              id="brand"
              label="¿Qué marca?"
              placeholder="Hino"
              maxLength={FLEET_LIMITS.brandModel}
              error={errors.brand?.message}
              registration={register('brand')}
            />
          )}
          {listedBrand ? (
            <>
              <AutocompleteField
                id="modelChoice"
                label="Modelo (opcional)"
                placeholder="Elige el modelo"
                options={modelOptions(values.brandChoice ?? '')}
                control={control}
                name="modelChoice"
                disabled={!canWrite}
              />
              {values.modelChoice === OTHER_CHOICE && (
                <TextField
                  id="model"
                  label="¿Qué modelo?"
                  placeholder="Cascadia"
                  maxLength={FLEET_LIMITS.brandModel}
                  error={errors.model?.message}
                  registration={register('model')}
                />
              )}
            </>
          ) : (
            <TextField
              id="model"
              label="Modelo (opcional)"
              placeholder="Cascadia"
              maxLength={FLEET_LIMITS.brandModel}
              error={errors.model?.message}
              registration={register('model')}
            />
          )}
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
          <DateField
            id="insuranceExpiresOn"
            label="Vencimiento del seguro (opcional)"
            hint="Te avisamos en Flota un mes antes."
            error={errors.insuranceExpiresOn?.message}
            control={control}
            name="insuranceExpiresOn"
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
