import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Stack from '@mui/material/Stack'
import CreateDialog from 'components/CreateDialogs/CreateDialog'
import NumberField from 'components/NumberField'
import TextField from 'components/TextField'
import type { Currency } from 'schemas/account'
import { extraSchema, TRIP_LIMITS, type ExtraValues } from 'schemas/trips'
import { currencySymbol } from 'utils/formatMoney'

interface ExtraDialogProps {
  /** The income being edited, or null for a new one. */
  extra: ExtraValues | null
  currency: Currency
  onSave: (extra: ExtraValues) => void
  onClose: () => void
}

/**
 * "Nuevo ingreso" of the trip (backend specs/0029 RF-3): it only changes the
 * form; the trip saves it.
 */
export default function ExtraDialog({
  extra,
  currency,
  onSave,
  onClose,
}: ExtraDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExtraValues>({
    resolver: zodResolver(extraSchema),
    defaultValues: extra ?? { description: '', amount: '' },
  })

  return (
    <CreateDialog
      title={extra ? 'Editar ingreso' : 'Nuevo ingreso'}
      formId="trip-extra"
      saveLabel="Guardar"
      onSubmit={event => {
        void handleSubmit(values => {
          onSave({ ...values, description: values.description.trim() })
          onClose()
        })(event)
      }}
      onClose={onClose}
    >
      <Stack spacing={6}>
        <TextField
          id="tripExtraDescription"
          label="Descripción"
          placeholder="Parada en León"
          maxLength={TRIP_LIMITS.extraDescription}
          error={errors.description?.message}
          registration={register('description')}
        />
        <NumberField
          id="tripExtraAmount"
          label="Monto"
          prefix={currencySymbol(currency)}
          placeholder="2,500"
          error={errors.amount?.message}
          registration={register('amount')}
        />
      </Stack>
    </CreateDialog>
  )
}
