import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from 'react-hook-form'
import ChoiceButtons from 'components/ChoiceButtons'
import AutocompleteField from 'components/AutocompleteField'
import ColorField from 'components/ColorField'
import DateField from 'components/DateField'
import MeasureHelp from 'components/MeasureHelp'
import MoreDetails, { countFilled } from 'components/MoreDetails'
import NumberField from 'components/NumberField'
import TextField from 'components/TextField'
import { TRUCK_BRANDS, TRUCK_MODELS } from 'data/truckModels'
import { FLEET_LIMITS, OTHER_CHOICE, type TruckFormValues } from 'schemas/fleet'
import { OWNERSHIP_OPTIONS } from 'utils/ownership'
import { ROLE_LABELS, type Role } from 'utils/roles'

/** The fields behind "Ver más detalles", for useMoreDetails (specs/0009). */
export const TRUCK_DETAILS = [
  'efficiency',
  'efficiencyEmpty',
  'odometer',
  'assignedDriverUid',
  'vin',
  'description',
] as const

/** Behind "Ver más detalles" when the screen shows them in sections (0032). */
export const TRUCK_SECTION_DETAILS = [
  'assignedDriverUid',
  'vin',
  'description',
] as const

/** A truck's fields in groups, for its screen's sections (specs/0032 RF-1). */
export interface TruckFieldGroups {
  /** Name, plate, brand, model, year, color and insurance. */
  identity: ReactNode
  /** Loaded and empty efficiency, and odometer. */
  performance: ReactNode
  /** "Ver más detalles": assigned driver, VIN and description. */
  more: ReactNode
}

// One ⓘ for both: one per field pushed "Cargado (opcional)" to two lines
const efficiencyHelp = (unit: 'km' | 'mi') =>
  `${unit === 'mi' ? 'Las millas' : 'Los km'} que recorre con un galón de combustible: cargado, yendo con carga; vacío, yendo sin ella.`

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

interface TruckFieldsProps {
  register: UseFormRegister<TruckFormValues>
  control: Control<TruckFormValues>
  setValue: UseFormSetValue<TruckFormValues>
  errors: FieldErrors<TruckFormValues>
  values: Partial<TruckFormValues>
  details: { open: boolean; toggle: () => void }
  /** The organization's distance unit (specs/0010). */
  unit: 'km' | 'mi'
  members: readonly { uid: string; displayName: string; role: Role }[]
  disabled?: boolean
  /** Before each id: two forms on one page (a trip and its dialog). */
  idPrefix?: string
  /** Laid out by the screen in sections (specs/0032); in a list otherwise. */
  sections?: (groups: TruckFieldGroups) => ReactNode
}

/**
 * A truck's fields (specs/0003, 0016, 0021), for its screen in Flota and the
 * "Nuevo camión" dialog of a trip or an expense (backend specs/0028).
 */
export default function TruckFields({
  register,
  control,
  setValue,
  errors,
  values,
  details,
  unit,
  members,
  disabled = false,
  idPrefix = '',
  sections,
}: TruckFieldsProps) {
  const listedBrand =
    values.brandChoice !== undefined &&
    values.brandChoice !== '' &&
    values.brandChoice !== OTHER_CHOICE
  const driverOptions = [
    { value: '', label: 'Sin asignar' },
    ...members.map(member => ({
      value: member.uid,
      label: `${member.displayName} (${ROLE_LABELS[member.role]})`,
    })),
  ]

  const identity = (
    <>
      <TextField
        id={`${idPrefix}name`}
        label="Nombre o número de unidad"
        placeholder="Unidad 12"
        error={errors.name?.message}
        registration={register('name')}
      />
      {/* Own or of a third party, and whose (backend specs/0035 RF-3) */}
      <ChoiceButtons
        id={`${idPrefix}ownership`}
        label="¿De quién es?"
        options={OWNERSHIP_OPTIONS}
        control={control}
        name="ownership"
        disabled={disabled}
      />
      {values.ownership === 'third_party' && (
        <TextField
          id={`${idPrefix}ownerName`}
          label="Dueño (opcional)"
          placeholder="Transportes López"
          maxLength={FLEET_LIMITS.ownerName}
          error={errors.ownerName?.message}
          registration={register('ownerName')}
        />
      )}
      <TextField
        id={`${idPrefix}plate`}
        label="Placa (opcional)"
        placeholder="M 123-456"
        error={errors.plate?.message}
        registration={register('plate')}
      />
      {/* From the list, or "Otra…" and typed (specs/0016 RF-2, RF-3) */}
      <AutocompleteField
        id={`${idPrefix}brandChoice`}
        label="Marca (opcional)"
        placeholder="Elige la marca"
        options={BRAND_OPTIONS}
        control={control}
        name="brandChoice"
        disabled={disabled}
        onChange={brand => {
          // A model belongs to one brand
          const models = TRUCK_MODELS[brand] ?? []
          if (!models.some(model => model.name === values.modelChoice))
            setValue('modelChoice', '')
        }}
      />
      {values.brandChoice === OTHER_CHOICE && (
        <TextField
          id={`${idPrefix}brand`}
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
            id={`${idPrefix}modelChoice`}
            label="Modelo (opcional)"
            placeholder="Elige el modelo"
            options={modelOptions(values.brandChoice ?? '')}
            control={control}
            name="modelChoice"
            disabled={disabled}
          />
          {values.modelChoice === OTHER_CHOICE && (
            <TextField
              id={`${idPrefix}model`}
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
          id={`${idPrefix}model`}
          label="Modelo (opcional)"
          placeholder="Cascadia"
          maxLength={FLEET_LIMITS.brandModel}
          error={errors.model?.message}
          registration={register('model')}
        />
      )}
      <TextField
        id={`${idPrefix}year`}
        label="Año (opcional)"
        placeholder="2019"
        inputMode="numeric"
        maxLength={4}
        error={errors.year?.message}
        registration={register('year')}
      />
      <ColorField
        idPrefix={idPrefix}
        control={control}
        swatchName="colorSwatch"
        isOther={values.colorSwatch === 'other'}
        otherRegistration={register('colorOther')}
        otherError={errors.colorOther?.message}
        disabled={disabled}
      />
      <DateField
        id={`${idPrefix}insuranceExpiresOn`}
        label="Vencimiento del seguro (opcional)"
        hint="Te avisamos en Flota un mes antes."
        error={errors.insuranceExpiresOn?.message}
        control={control}
        name="insuranceExpiresOn"
        disabled={disabled}
      />
    </>
  )
  const performance = (
    <>
      {/* Loaded and empty on one row (backend specs/0021 RF-4): short
        labels under a title, or they wrap unevenly at 375 px */}
      <Box role="group" aria-labelledby={`${idPrefix}efficiency-title`}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            id={`${idPrefix}efficiency-title`}
            variant="overline"
            component="p"
            sx={{ color: 'text.secondary' }}
          >
            Rendimiento
          </Typography>
          <MeasureHelp label="el rendimiento" text={efficiencyHelp(unit)} />
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 2,
          }}
        >
          <NumberField
            id={`${idPrefix}efficiency`}
            dense
            label="Cargado (opcional)"
            unit={`${unit}/gal`}
            placeholder="Ej. 6.5"
            error={errors.efficiency?.message}
            registration={register('efficiency')}
          />
          <NumberField
            id={`${idPrefix}efficiencyEmpty`}
            dense
            label="Vacío (opcional)"
            unit={`${unit}/gal`}
            placeholder="Ej. 8"
            error={errors.efficiencyEmpty?.message}
            registration={register('efficiencyEmpty')}
          />
        </Box>
        <Typography
          variant="caption"
          component="p"
          sx={{ mt: 1, color: 'text.secondary' }}
        >
          Para estimar cuánto puedes recorrer con el combustible, cargado y
          vacío.
        </Typography>
      </Box>
      <NumberField
        id={`${idPrefix}odometer`}
        label="Odómetro (opcional)"
        unit={unit}
        placeholder="Ej. 120000"
        hint={`El ${unit === 'mi' ? 'millaje' : 'kilometraje'} actual. La unidad se cambia en Mi cuenta.`}
        error={errors.odometer?.message}
        registration={register('odometer')}
      />
    </>
  )
  const rest = (
    <>
      <AutocompleteField
        id={`${idPrefix}assignedDriverUid`}
        label="Chofer asignado (opcional)"
        options={driverOptions}
        control={control}
        name="assignedDriverUid"
        disabled={disabled}
      />
      <TextField
        id={`${idPrefix}vin`}
        label="VIN o número de serie (opcional)"
        error={errors.vin?.message}
        registration={register('vin')}
      />
      <TextField
        id={`${idPrefix}description`}
        label="Descripción (opcional)"
        placeholder="Notas para tu equipo"
        error={errors.description?.message}
        registration={register('description')}
      />
    </>
  )

  if (sections) {
    return sections({
      identity,
      performance,
      more: (
        <MoreDetails
          open={details.open}
          onToggle={details.toggle}
          filled={countFilled([
            values.assignedDriverUid,
            values.vin,
            values.description,
          ])}
        >
          {rest}
        </MoreDetails>
      ),
    })
  }
  return (
    <Stack spacing={5}>
      {identity}
      <MoreDetails
        open={details.open}
        onToggle={details.toggle}
        filled={countFilled([
          values.efficiency,
          values.efficiencyEmpty,
          values.odometer,
          values.assignedDriverUid,
          values.vin,
          values.description,
        ])}
      >
        {performance}
        {rest}
      </MoreDetails>
    </Stack>
  )
}
