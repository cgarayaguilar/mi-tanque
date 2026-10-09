import type { ReactNode } from 'react'
import Stack from '@mui/material/Stack'
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import ChoiceButtons from 'components/ChoiceButtons'
import AutocompleteField, {
  type CreateOption,
} from 'components/AutocompleteField'
import ColorField from 'components/ColorField'
import DateField from 'components/DateField'
import MoreDetails, { countFilled } from 'components/MoreDetails'
import NumberField from 'components/NumberField'
import SelectField from 'components/SelectField'
import TextField from 'components/TextField'
import {
  FLEET_LIMITS,
  TRAILER_TYPES,
  type TrailerFormValues,
} from 'schemas/fleet'
import { OWNERSHIP_OPTIONS } from 'utils/ownership'

/** The fields behind "Ver más detalles", for useMoreDetails (specs/0009). */
export const TRAILER_DETAILS = [
  'reeferConsumption',
  'vin',
  'description',
] as const

interface TrailerFieldsProps {
  register: UseFormRegister<TrailerFormValues>
  control: Control<TrailerFormValues>
  errors: FieldErrors<TrailerFormValues>
  values: Partial<TrailerFormValues>
  details: { open: boolean; toggle: () => void }
  /** "Enganchado a": the active trucks, and the one it has. */
  truckOptions: readonly { value: string; label: string }[]
  disabled?: boolean
  /** Before each id: two forms on one page (a trip and its dialog). */
  idPrefix?: string
  /** "+ Crear camión" in "Enganchado a" (backend specs/0031). */
  createTruck?: CreateOption | undefined
  /** Laid out by the screen in sections (specs/0032); in a list otherwise. */
  sections?: (groups: { identity: ReactNode; more: ReactNode }) => ReactNode
}

/**
 * A trailer's fields (specs/0003), for its screen in Flota and the "Nuevo
 * remolque" dialog of a trip or an expense (backend specs/0028).
 */
export default function TrailerFields({
  register,
  control,
  errors,
  values,
  details,
  truckOptions,
  disabled = false,
  idPrefix = '',
  createTruck,
  sections,
}: TrailerFieldsProps) {
  const identity = (
    <>
      <TextField
        id={`${idPrefix}name`}
        label="Nombre o número de unidad"
        placeholder="Caja 7"
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
      <SelectField
        id={`${idPrefix}trailerType`}
        label="Tipo de remolque"
        options={TRAILER_TYPES.map(type => ({
          value: type.id,
          label: type.label,
        }))}
        control={control}
        name="trailerType"
        disabled={disabled}
      />
      {values.trailerType === 'other' && (
        <TextField
          id={`${idPrefix}trailerTypeOther`}
          label="¿Qué tipo?"
          placeholder="Jaula ganadera"
          maxLength={FLEET_LIMITS.trailerTypeOther}
          error={errors.trailerTypeOther?.message}
          registration={register('trailerTypeOther')}
        />
      )}
      <AutocompleteField
        id={`${idPrefix}hitchedTruckId`}
        label="Enganchado a (opcional)"
        options={truckOptions}
        hint="De este camión sale el rendimiento para estimar distancias."
        control={control}
        name="hitchedTruckId"
        disabled={disabled}
        create={createTruck}
      />
      <NumberField
        id={`${idPrefix}lengthFt`}
        label="Largo (opcional)"
        unit="pies"
        placeholder="Ej. 53"
        hint="Entre 10 y 60 pies."
        error={errors.lengthFt?.message}
        registration={register('lengthFt')}
      />
      <TextField
        id={`${idPrefix}plate`}
        label="Placa (opcional)"
        error={errors.plate?.message}
        registration={register('plate')}
      />
      <Stack direction="row" spacing={3}>
        <TextField
          id={`${idPrefix}brand`}
          label="Marca (opcional)"
          placeholder="Utility"
          error={errors.brand?.message}
          registration={register('brand')}
        />
        <TextField
          id={`${idPrefix}model`}
          label="Modelo (opcional)"
          placeholder="3000R"
          error={errors.model?.message}
          registration={register('model')}
        />
      </Stack>
      <TextField
        id={`${idPrefix}year`}
        label="Año (opcional)"
        placeholder="2018"
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
  const more = (
    <MoreDetails
      open={details.open}
      onToggle={details.toggle}
      filled={countFilled([
        values.trailerType === 'reefer' ? values.reeferConsumption : '',
        values.vin,
        values.description,
      ])}
    >
      {values.trailerType === 'reefer' && (
        <NumberField
          id={`${idPrefix}reeferConsumption`}
          label="Consumo del equipo de frío (opcional)"
          unit="gal/h"
          placeholder="Ej. 0.8"
          hint="Galones por hora del termo."
          error={errors.reeferConsumption?.message}
          registration={register('reeferConsumption')}
        />
      )}
      <TextField
        id={`${idPrefix}vin`}
        label="VIN o número de serie (opcional)"
        error={errors.vin?.message}
        registration={register('vin')}
      />
      <TextField
        id={`${idPrefix}description`}
        label="Descripción (opcional)"
        error={errors.description?.message}
        registration={register('description')}
      />
    </MoreDetails>
  )
  if (sections) return sections({ identity, more })
  return (
    <Stack spacing={5}>
      {identity}
      {more}
    </Stack>
  )
}
