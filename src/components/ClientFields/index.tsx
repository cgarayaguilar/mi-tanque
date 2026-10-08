import Stack from '@mui/material/Stack'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import MeasureHelp from 'components/MeasureHelp'
import MoreDetails, { countFilled } from 'components/MoreDetails'
import TextField from 'components/TextField'
import { CLIENT_LIMITS, type ClientFormValues } from 'schemas/clients'

/** The fields behind "Ver más detalles", for useMoreDetails. */
export const CLIENT_DETAILS = ['phone', 'email', 'taxId', 'notes'] as const

interface ClientFieldsProps {
  register: UseFormRegister<ClientFormValues>
  errors: FieldErrors<ClientFormValues>
  values: Partial<ClientFormValues>
  details: { open: boolean; toggle: () => void }
}

/**
 * A client's fields (backend specs/0022 RF-6), for its screen in Flota and,
 * in specs/0025, the "Nuevo cliente" dialog of a trip (RF-8).
 */
export default function ClientFields({
  register,
  errors,
  values,
  details,
}: ClientFieldsProps) {
  return (
    <Stack spacing={5}>
      <TextField
        id="clientName"
        label="Nombre del cliente"
        placeholder="Transportes Pérez"
        maxLength={CLIENT_LIMITS.name}
        error={errors.name?.message}
        registration={register('name')}
      />
      <MoreDetails
        open={details.open}
        onToggle={details.toggle}
        filled={countFilled([
          values.phone,
          values.email,
          values.taxId,
          values.notes,
        ])}
      >
        <TextField
          id="clientPhone"
          label="Teléfono (opcional)"
          placeholder="8888 7777"
          type="tel"
          inputMode="tel"
          maxLength={CLIENT_LIMITS.phone}
          error={errors.phone?.message}
          registration={register('phone')}
        />
        <TextField
          id="clientEmail"
          label="Correo (opcional)"
          placeholder="compras@empresa.com"
          type="email"
          inputMode="email"
          maxLength={CLIENT_LIMITS.email}
          error={errors.email?.message}
          registration={register('email')}
        />
        <TextField
          id="clientTaxId"
          label="Número fiscal (opcional)"
          placeholder="J0310000012345"
          help={
            <MeasureHelp
              label="el número fiscal"
              text="El RUC, NIT o RTN del cliente, para tus facturas."
            />
          }
          maxLength={CLIENT_LIMITS.taxId}
          error={errors.taxId?.message}
          registration={register('taxId')}
        />
        <TextField
          id="clientNotes"
          label="Notas (opcional)"
          placeholder="Contacto, horarios de carga…"
          maxLength={CLIENT_LIMITS.notes}
          error={errors.notes?.message}
          registration={register('notes')}
        />
      </MoreDetails>
    </Stack>
  )
}
