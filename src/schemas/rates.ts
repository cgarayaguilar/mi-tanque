// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import type { Currency } from 'schemas/account'
import type { Client } from 'schemas/clients'
import { optionalText, requiredText } from 'schemas/fleet'
import { foldText, squeezeSpaces } from 'utils/foldText'
import { currencySymbol } from 'utils/formatMoney'
import { formatEditable, formatNumber } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'

/** Mirrors the rules of `rates` (backend specs/0024 RF-1). */
export const RATE_LIMITS = {
  place: 80,
  description: 500,
  priceMax: 100_000_000,
}

export interface Rate {
  id: string
  orgId: string
  /** "Managua → San José": not stored, for the fleet's lists and screens. */
  name: string
  origin: string
  destination: string
  price: number
  /** The organization's when it was made; it does not change (RF-2). */
  currency: Currency
  clientId: string | null
  /** The client's name when saved; the current one is shown if it exists. */
  clientName: string | null
  description: string | null
  /** "Managua - San José - C$25,000.00" (RF-1). */
  label: string
  archived: boolean
}

/** How a rate is called on screen: "Managua → San José". */
export const routeName = (origin: string, destination: string) =>
  `${origin} → ${destination}`

/** The group of the rates without a client (specs/0024 RF-5). */
export const GENERAL_RATES = 'General'

/**
 * The rates under their client's name (specs/0033 RF-3, RF-4): `first`'s
 * client's first, then "General", then the other clients A–Z; inside, A–Z.
 */
export const ratesByClient = <
  T extends Pick<Rate, 'clientId' | 'clientName' | 'label'>,
>(
  rates: readonly T[],
  clientNameOf: (clientId: string) => string | null,
  first: string | null = null
) =>
  rates
    .map(rate => ({
      rate,
      group:
        rate.clientId === null
          ? GENERAL_RATES
          : (clientNameOf(rate.clientId) ?? rate.clientName ?? ''),
      rank:
        rate.clientId !== null && rate.clientId === first
          ? 0
          : rate.clientId === null
            ? 1
            : 2,
    }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.group.localeCompare(b.group, 'es') ||
        a.rate.label.localeCompare(b.rate.label, 'es')
    )
    .map(({ rate, group }) => ({ rate, group }))

/** Stored with 2 decimals, like every amount (specs/0012). */
const toCents = (value: number) => Math.round(value * 100) / 100

export const rateFormSchema = z.object({
  origin: requiredText('Escribe el origen', RATE_LIMITS.place),
  destination: requiredText('Escribe el destino', RATE_LIMITS.place),
  price: z.string().check(
    z.trim(),
    z.refine(value => value !== '', {
      error: 'Escribe el precio',
      abort: true,
    }),
    z.refine(value => !Number.isNaN(parseDecimal(value)), {
      error: 'Escribe solo números, por ejemplo 25,000',
      abort: true,
    }),
    z.refine(value => toCents(parseDecimal(value)) > 0, {
      error: 'Ingresa un precio mayor que 0',
      abort: true,
    }),
    z.refine(value => parseDecimal(value) <= RATE_LIMITS.priceMax, {
      error: 'El precio es demasiado alto',
    })
  ),
  clientId: z.string(),
  description: optionalText(RATE_LIMITS.description),
})

export type RateFormValues = z.infer<typeof rateFormSchema>

/** "Managua - San José - C$25,000.00": the price with its symbol, no code. */
export const rateLabel = (
  origin: string,
  destination: string,
  price: number,
  currency: Currency
) =>
  `${origin.trim()} - ${destination.trim()} - ${currencySymbol(currency)}${formatNumber(price, 2)}`

/** The fields written (RF-1); the client's name comes from the list. */
export const rateFromForm = (
  values: RateFormValues,
  currency: Currency,
  clients: readonly Client[]
) => {
  const origin = squeezeSpaces(values.origin)
  const destination = squeezeSpaces(values.destination)
  const price = toCents(parseDecimal(values.price))
  const client = clients.find(item => item.id === values.clientId) ?? null
  return {
    origin,
    destination,
    price,
    currency,
    clientId: client?.id ?? null,
    clientName: client?.name ?? null,
    description: values.description.trim() || null,
    label: rateLabel(origin, destination, price, currency),
  }
}

export const rateToForm = (rate: Rate | null): RateFormValues => ({
  origin: rate?.origin ?? '',
  destination: rate?.destination ?? '',
  price: rate ? formatEditable(rate.price) : '',
  clientId: rate?.clientId ?? '',
  description: rate?.description ?? '',
})

const placeKey = (place: string) => foldText(place).trim().replace(/\s+/g, ' ')

/**
 * Another rate with this route, client and price, archived ones included
 * (RF-8): the same route with another price is another rate.
 */
export const sameRate = (
  candidate: Pick<
    Rate,
    'origin' | 'destination' | 'clientId' | 'price' | 'currency'
  >,
  rates: readonly Rate[],
  selfId: string
): Rate | null =>
  rates.find(
    rate =>
      rate.id !== selfId &&
      placeKey(rate.origin) === placeKey(candidate.origin) &&
      placeKey(rate.destination) === placeKey(candidate.destination) &&
      rate.clientId === candidate.clientId &&
      rate.price === candidate.price &&
      // The same number in another currency is another rate (audit 0027)
      rate.currency === candidate.currency
  ) ?? null

export const duplicateRateMessage = (other: Rate) =>
  other.archived
    ? `Ya existe esta tarifa: ${other.label}. Restáurala en Archivados`
    : `Ya existe esta tarifa: ${other.label}`

/**
 * The places already used, origins and destinations together, once each
 * however they were written (RF-7), in alphabetical order: of the rates
 * and, since specs/0025, of the trips.
 */
export const knownPlaces = (
  rates: readonly Pick<Rate, 'origin' | 'destination'>[]
) => {
  const places = new Map<string, string>()
  for (const rate of rates) {
    for (const place of [rate.origin, rate.destination]) {
      const key = placeKey(place)
      if (!places.has(key)) places.set(key, place.trim())
    }
  }
  return [...places.values()].sort((a, b) => a.localeCompare(b, 'es'))
}

/**
 * A typed place as it is already written: "managua" is saved "Managua" if
 * that is how the organization's rates have it (RF-7), so one place is not
 * written two ways.
 */
export const knownSpelling = (typed: string, places: readonly string[]) => {
  const key = placeKey(typed)
  return places.find(place => placeKey(place) === key) ?? typed.trim()
}
