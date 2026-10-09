import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import AutocompleteField, {
  type CreateOption,
} from 'components/AutocompleteField'
import NumberField from 'components/NumberField'
import type { SelectOption } from 'components/SelectField'
import TextField from 'components/TextField'
import { CURRENCY_DETAILS, type Currency } from 'schemas/account'
import { RATE_LIMITS, rateLabel, type RateFormValues } from 'schemas/rates'
import { currencySymbol } from 'utils/formatMoney'
import { parseDecimal } from 'utils/parseDecimal'

const PLACES_ID = 'rate-places'

interface RateFieldsProps {
  register: UseFormRegister<RateFormValues>
  control: Control<RateFormValues>
  errors: FieldErrors<RateFormValues>
  values: Partial<RateFormValues>
  currency: Currency
  /** Places already used, suggested in origin and destination (RF-7). */
  places: readonly string[]
  /** "General (sin cliente)" and the active clients. */
  clientOptions: SelectOption[]
  disabled: boolean
  /** "+ Crear cliente" in Cliente (backend specs/0031). */
  createClient?: CreateOption | undefined
}

/** A rate's fields (backend specs/0024 RF-6). */
export default function RateFields({
  register,
  control,
  errors,
  values,
  currency,
  places,
  clientOptions,
  disabled,
  createClient,
}: RateFieldsProps) {
  const price = parseDecimal(values.price ?? '')
  const origin = values.origin?.trim() ?? ''
  const destination = values.destination?.trim() ?? ''
  // The label as it will be saved, once there is something to show
  const label =
    origin && destination && price > 0
      ? rateLabel(origin, destination, Math.round(price * 100) / 100, currency)
      : null

  return (
    <Stack spacing={5}>
      {/* Origin and destination on one row, on a phone too (RNF-3) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 2,
        }}
      >
        <TextField
          id="rateOrigin"
          dense
          label="Origen"
          placeholder="Managua"
          maxLength={RATE_LIMITS.place}
          list={PLACES_ID}
          error={errors.origin?.message}
          registration={register('origin')}
        />
        <TextField
          id="rateDestination"
          dense
          label="Destino"
          placeholder="San José"
          maxLength={RATE_LIMITS.place}
          list={PLACES_ID}
          error={errors.destination?.message}
          registration={register('destination')}
        />
      </Box>
      <datalist id={PLACES_ID}>
        {places.map(place => (
          <option key={place} value={place} />
        ))}
      </datalist>
      <NumberField
        id="ratePrice"
        label="Precio"
        prefix={currencySymbol(currency)}
        placeholder="25,000"
        hint={`En ${CURRENCY_DETAILS[currency].name.toLowerCase()}, la moneda de tu organización.`}
        error={errors.price?.message}
        registration={register('price')}
      />
      <AutocompleteField
        id="rateClientId"
        label="Cliente (opcional)"
        options={clientOptions}
        error={errors.clientId?.message}
        control={control}
        name="clientId"
        disabled={disabled}
        create={createClient}
      />
      <TextField
        id="rateDescription"
        label="Descripción (opcional)"
        placeholder="Contenedor de 40 pies, refrigerado"
        maxLength={RATE_LIMITS.description}
        error={errors.description?.message}
        registration={register('description')}
      />
      {label && (
        <Typography
          variant="caption"
          component="p"
          aria-live="polite"
          sx={{ color: 'text.secondary' }}
        >
          Se verá así: {label}
        </Typography>
      )}
    </Stack>
  )
}
