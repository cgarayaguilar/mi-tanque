import { useEffect, useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto'
import NumberField from 'components/NumberField'
import AutocompleteField from 'components/AutocompleteField'
import ChoiceButtons from 'components/ChoiceButtons'
import Stat from 'components/Stat'
import TextField from 'components/TextField'
import { CURRENCY_OPTIONS, type Currency } from 'schemas/account'
import { KM_PER_MILE } from 'schemas/fleet'
import {
  optionalNumber,
  refuelFormSchema,
  STATION_MAX,
  VOLUME_UNIT_LABELS,
  type RefuelFormValues,
} from 'schemas/refuelForm'
import { radius } from 'theme/tokens'
import type { RefuelValues } from 'types'
import { compressImage } from 'utils/compressImage'
import { formatNumber } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'
import { refuelAmounts, refuelLevels } from 'utils/refuelMath'
import { reportError } from 'utils/reportError'
import type { TankGeometry } from 'utils/tankVolume'

export interface RefuelResult {
  values: RefuelValues
  odometerKm: number | null
  photo: Blob | null
}

interface RefuelFormProps {
  geometry: TankGeometry
  maxInches: number
  capacityGal: number
  /** The organization's currency; '' without an account (RF-2). */
  defaultCurrency: Currency | ''
  /** Latest level of the tank, for "before" without inches (RF-3). */
  lastGallons: number | null
  stations: readonly string[]
  /** A truck tank asks for the odometer, in the truck's unit. */
  odometer: { unit: 'km' | 'mi'; truckName: string } | null
  /** With an account the invoice photo can be attached (RF-6). */
  allowsPhoto: boolean
  canSave: boolean
  /** Values to correct (edit dialog); without them, a new refuel. */
  initial?: RefuelFormValues
  submitLabel: string
  onSave: (result: RefuelResult) => void
}

const UNIT_OPTIONS = (['liter', 'gallon'] as const).map(value => ({
  value,
  label: VOLUME_UNIT_LABELS[value],
}))

const PRICE_UNIT_OPTIONS = [
  { value: 'liter', label: 'litro' },
  { value: 'gallon', label: 'galón' },
]

export const money = (currency: string, amount: number) =>
  `${currency} ${formatNumber(amount, 2)}`

/** "40 gal (30 %)", or "sin dato". */
export const levelText = (gallons: number | null, percent: number | null) =>
  gallons === null
    ? 'sin dato'
    : `${formatNumber(gallons, 2)} gal${percent === null ? '' : ` (${formatNumber(Math.round(percent))} %)`}`

const EMPTY: RefuelFormValues = {
  quantity: '',
  quantityUnit: 'liter',
  price: '',
  priceUnit: 'liter',
  currency: '',
  total: '',
  inchesBefore: '',
  inchesAfter: '',
  odometer: '',
  stationName: '',
}

/**
 * A refuel (backend specs/0006 RF-2–RF-4): quantity and price in either
 * unit, the total computed live and correctable, optional levels, station
 * with suggestions and, with an account, the invoice photo.
 */
export default function RefuelForm({
  geometry,
  maxInches,
  capacityGal,
  defaultCurrency,
  lastGallons,
  stations,
  odometer,
  allowsPhoto,
  canSave,
  initial,
  submitLabel,
  onSave,
}: RefuelFormProps) {
  const stationsId = useId()
  const photoInputId = useId()
  const [correctingTotal, setCorrectingTotal] = useState(
    initial !== undefined && initial.total !== ''
  )
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RefuelFormValues>({
    resolver: zodResolver(
      refuelFormSchema({ maxInches, maxGallons: capacityGal * 2 })
    ),
    defaultValues: initial ?? { ...EMPTY, currency: defaultCurrency },
  })
  const watched = useWatch({ control })

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview]
  )

  const quantity = parseDecimal(watched.quantity ?? '')
  const price = parseDecimal(watched.price ?? '')
  const live =
    quantity > 0 && price > 0
      ? refuelAmounts({
          quantity,
          quantityUnit: watched.quantityUnit ?? 'liter',
          price,
          priceUnit: watched.priceUnit ?? 'liter',
        })
      : null
  const currency = watched.currency ?? ''

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return
    try {
      const compressed = await compressImage(file)
      setPhoto(compressed)
      setPreview(URL.createObjectURL(compressed))
    } catch (error) {
      reportError(error, { operation: 'compressInvoice' })
      sileo.error({
        title: 'No pudimos usar esa foto',
        description: 'Prueba con otra o toma la foto de nuevo.',
      })
    }
  }

  const submit = (form: RefuelFormValues) => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
    const amounts = refuelAmounts({
      quantity: parseDecimal(form.quantity),
      quantityUnit: form.quantityUnit,
      price: parseDecimal(form.price),
      priceUnit: form.priceUnit,
    })
    const correctedTotal = optionalNumber(form.total)
    const levels = refuelLevels({
      geometry,
      gallonsAdded: amounts.gallonsAdded,
      inchesBefore: optionalNumber(form.inchesBefore),
      inchesAfter: optionalNumber(form.inchesAfter),
      lastGallons,
    })
    const odometerValue = odometer ? optionalNumber(form.odometer) : null
    onSave({
      values: {
        ...amounts,
        total: correctedTotal ?? amounts.total,
        quantityUnit: form.quantityUnit,
        priceUnit: form.priceUnit,
        currency: form.currency as Currency,
        inchesBefore: optionalNumber(form.inchesBefore),
        inchesAfter: optionalNumber(form.inchesAfter),
        ...levels,
        stationName: form.stationName.trim() || null,
      },
      odometerKm:
        odometerValue === null
          ? null
          : Math.round(
              odometerValue * (odometer?.unit === 'mi' ? KM_PER_MILE : 1)
            ),
      photo,
    })
    if (!initial) {
      reset({ ...EMPTY, currency: form.currency })
      setCorrectingTotal(false)
      setPhoto(null)
      setPreview(null)
    }
  }

  return (
    <Box
      component="form"
      noValidate
      aria-label={initial ? 'Corregir relleno' : 'Nuevo relleno'}
      onSubmit={event => {
        void handleSubmit(submit)(event)
      }}
      sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 4 }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2 }}>
        <NumberField
          id="refuelQuantity"
          label="Cantidad echada"
          unit={VOLUME_UNIT_LABELS[watched.quantityUnit ?? 'liter']}
          placeholder="Ej. 50"
          hint=""
          error={errors.quantity?.message}
          registration={register('quantity')}
        />
        <ChoiceButtons
          id="refuelQuantityUnit"
          label="Unidad"
          options={UNIT_OPTIONS}
          control={control}
          name="quantityUnit"
        />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2 }}>
        <NumberField
          id="refuelPrice"
          label="Precio"
          unit={currency || '—'}
          placeholder="Ej. 30.50"
          hint=""
          error={errors.price?.message}
          registration={register('price')}
        />
        <ChoiceButtons
          id="refuelPriceUnit"
          label="Por"
          options={PRICE_UNIT_OPTIONS}
          control={control}
          name="priceUnit"
        />
      </Box>
      <AutocompleteField
        id="refuelCurrency"
        label="Moneda"
        placeholder="Elige la moneda"
        options={CURRENCY_OPTIONS}
        error={errors.currency?.message}
        control={control}
        name="currency"
      />

      <Box
        aria-live="polite"
        sx={{
          px: 4,
          py: 3,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: `${String(radius.lg)}px`,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 2,
          }}
        >
          <Stat
            size="small"
            label="Echaste"
            value={live ? `${formatNumber(live.gallonsAdded, 2)} gal` : '—'}
            caption={live ? `${formatNumber(live.litersAdded, 2)} L` : ''}
          />
          <Stat
            size="small"
            label="Total"
            value={live && currency ? money(currency, live.total) : '—'}
            caption={
              live && currency
                ? `${money(currency, live.pricePerGallon)}/gal · ${money(currency, live.pricePerLiter)}/L`
                : ''
            }
          />
        </Box>
      </Box>
      {correctingTotal ? (
        <NumberField
          id="refuelTotal"
          label="Total de la factura (opcional)"
          unit={currency || '—'}
          placeholder={live ? formatNumber(live.total, 2) : 'Ej. 1500'}
          hint="Déjalo vacío para usar el total calculado."
          error={errors.total?.message}
          registration={register('total')}
        />
      ) : (
        <Button
          size="small"
          onClick={() => {
            setCorrectingTotal(true)
          }}
          sx={{ alignSelf: 'flex-start' }}
        >
          Corregir total
        </Button>
      )}

      <Typography
        variant="overline"
        component="p"
        sx={{ color: 'text.secondary', mt: 2 }}
      >
        Nivel del tanque
      </Typography>
      <Box
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}
      >
        <NumberField
          id="refuelInchesBefore"
          label="Antes (opcional)"
          unit="pulg."
          placeholder="Ej. 6"
          hint=""
          error={errors.inchesBefore?.message}
          registration={register('inchesBefore')}
        />
        <NumberField
          id="refuelInchesAfter"
          label="Después (opcional)"
          unit="pulg."
          placeholder="Ej. 20"
          hint=""
          error={errors.inchesAfter?.message}
          registration={register('inchesAfter')}
        />
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {lastGallons === null
          ? 'Sin pulgadas, el nivel queda sin dato: este tanque no tiene lecturas.'
          : `Sin pulgadas, "antes" es la última lectura (${formatNumber(lastGallons, 2)} gal) y "después" le suma lo echado.`}
      </Typography>

      {odometer && (
        <NumberField
          id="refuelOdometer"
          label="Odómetro (opcional)"
          unit={odometer.unit}
          placeholder="Ej. 120500"
          hint={`El de ${odometer.truckName}: con dos rellenos con odómetro sale el rendimiento.`}
          error={errors.odometer?.message}
          registration={register('odometer')}
        />
      )}
      <TextField
        id="refuelStation"
        label="Gasolinera (opcional)"
        placeholder="Ej. Puma Km 7"
        maxLength={STATION_MAX}
        list={stationsId}
        error={errors.stationName?.message}
        registration={register('stationName')}
      />
      <datalist id={stationsId}>
        {stations.map(name => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {allowsPhoto && (
        <Box>
          <input
            id={photoInputId}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={event => {
              void choosePhoto(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <Button
            component="label"
            htmlFor={photoInputId}
            variant="outlined"
            fullWidth
            startIcon={<AddAPhotoIcon />}
          >
            {photo
              ? 'Cambiar foto de la factura'
              : 'Foto de la factura (opcional)'}
          </Button>
          {preview && (
            <Box
              component="img"
              src={preview}
              alt="Factura elegida"
              sx={{
                display: 'block',
                mt: 2,
                maxHeight: 160,
                maxWidth: '100%',
                borderRadius: `${String(radius.md)}px`,
              }}
            />
          )}
        </Box>
      )}

      <Button
        type="submit"
        variant="contained"
        size="large"
        fullWidth
        loading={isSubmitting}
        disabled={!canSave}
      >
        {submitLabel}
      </Button>
      {!canSave && (
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', textAlign: 'center' }}
        >
          Con tu rol de Lectura no puedes registrar rellenos.
        </Typography>
      )}
    </Box>
  )
}
