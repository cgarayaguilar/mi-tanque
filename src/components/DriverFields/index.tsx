import Stack from '@mui/material/Stack'
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import AutocompleteField from 'components/AutocompleteField'
import DateField from 'components/DateField'
import MoreDetails, { countFilled } from 'components/MoreDetails'
import TextField from 'components/TextField'
import { DRIVER_LIMITS, type DriverFormValues } from 'schemas/drivers'
import type { SelectOption } from 'components/SelectField'

/** The fields behind "Ver más detalles", for useMoreDetails. */
export const DRIVER_DETAILS = ['phone', 'licenseNumber', 'memberUid'] as const

interface DriverFieldsProps {
  register: UseFormRegister<DriverFormValues>
  control: Control<DriverFormValues>
  errors: FieldErrors<DriverFormValues>
  values: Partial<DriverFormValues>
  details: { open: boolean; toggle: () => void }
  /** "Sin cuenta" and the organization's members. */
  memberOptions: SelectOption[]
  disabled: boolean
}

/** A driver's fields (backend specs/0023 RF-7). */
export default function DriverFields({
  register,
  control,
  errors,
  values,
  details,
  memberOptions,
  disabled,
}: DriverFieldsProps) {
  return (
    <Stack spacing={5}>
      <TextField
        id="driverName"
        label="Nombre del conductor"
        placeholder="Pedro Ruiz"
        maxLength={DRIVER_LIMITS.name}
        error={errors.name?.message}
        registration={register('name')}
      />
      <DateField
        id="licenseExpiresOn"
        label="Vencimiento de la licencia (opcional)"
        hint="Te avisamos en Flota un mes antes."
        error={errors.licenseExpiresOn?.message}
        control={control}
        name="licenseExpiresOn"
        disabled={disabled}
      />
      <MoreDetails
        open={details.open}
        onToggle={details.toggle}
        filled={countFilled([
          values.phone,
          values.licenseNumber,
          values.memberUid,
        ])}
      >
        <TextField
          id="driverPhone"
          label="Teléfono (opcional)"
          placeholder="8888 7777"
          type="tel"
          inputMode="tel"
          maxLength={DRIVER_LIMITS.phone}
          error={errors.phone?.message}
          registration={register('phone')}
        />
        <TextField
          id="licenseNumber"
          label="Número de licencia (opcional)"
          placeholder="A-123456"
          maxLength={DRIVER_LIMITS.licenseNumber}
          error={errors.licenseNumber?.message}
          registration={register('licenseNumber')}
        />
        <AutocompleteField
          id="memberUid"
          label="Miembro del equipo (opcional)"
          options={memberOptions}
          hint="Enlázalo si tiene cuenta en la app, para llenarlo solo en los viajes del camión que tiene asignado."
          error={errors.memberUid?.message}
          control={control}
          name="memberUid"
          disabled={disabled}
        />
      </MoreDetails>
    </Stack>
  )
}
