import type { Currency } from 'schemas/account'
import {
  fullVolumeGallons,
  gallonsAt,
  type TankGeometry,
} from 'utils/tankVolume'

// Refuel calculations (backend specs/0006 RF-2, RF-3, RF-8, RF-9). Pure:
// the same functions serve the basic mode and the organization's fleet.

export type VolumeUnit = 'gallon' | 'liter'

export const LITERS_PER_GALLON = 3.785411784

const round2 = (value: number) => Math.round(value * 100) / 100

export interface RefuelAmounts {
  gallonsAdded: number
  litersAdded: number
  pricePerGallon: number
  pricePerLiter: number
  /** Quantity × price, before any correction from the invoice. */
  total: number
}

/** Both units of the quantity and the price, and the total (RF-2). */
export const refuelAmounts = ({
  quantity,
  quantityUnit,
  price,
  priceUnit,
}: {
  quantity: number
  quantityUnit: VolumeUnit
  price: number
  priceUnit: VolumeUnit
}): RefuelAmounts => {
  const gallons =
    quantityUnit === 'gallon' ? quantity : quantity / LITERS_PER_GALLON
  const liters =
    quantityUnit === 'liter' ? quantity : quantity * LITERS_PER_GALLON
  // The total uses the price in the unit it was written: no rounding drift
  const total = priceUnit === 'liter' ? liters * price : gallons * price
  return {
    gallonsAdded: round2(gallons),
    litersAdded: round2(liters),
    pricePerGallon: round2(
      priceUnit === 'gallon' ? price : price * LITERS_PER_GALLON
    ),
    pricePerLiter: round2(
      priceUnit === 'liter' ? price : price / LITERS_PER_GALLON
    ),
    total: round2(total),
  }
}

export interface RefuelLevels {
  gallonsBefore: number | null
  gallonsAfter: number | null
  fillPercentBefore: number | null
  fillPercentAfter: number | null
}

/**
 * Levels before and after (RF-3): from the inches when given; otherwise
 * before is the latest reading and after = before + added, capped at the
 * tank's volume. Unknown without either.
 */
export const refuelLevels = ({
  geometry,
  gallonsAdded,
  inchesBefore,
  inchesAfter,
  lastGallons,
}: {
  geometry: TankGeometry
  gallonsAdded: number
  inchesBefore: number | null
  inchesAfter: number | null
  lastGallons: number | null
}): RefuelLevels => {
  const full = fullVolumeGallons(geometry)
  const before =
    inchesBefore !== null ? gallonsAt(geometry, inchesBefore) : lastGallons
  const after =
    inchesAfter !== null
      ? gallonsAt(geometry, inchesAfter)
      : before === null
        ? null
        : Math.min(full, before + gallonsAdded)
  const percent = (gallons: number | null) =>
    gallons === null || full <= 0
      ? null
      : round2(Math.min(100, (gallons / full) * 100))
  return {
    gallonsBefore: before === null ? null : round2(before),
    gallonsAfter: after === null ? null : round2(after),
    fillPercentBefore: percent(before),
    fillPercentAfter: percent(after),
  }
}

/**
 * All the fuel of the truck before and after (RF-9): the refueled tank's
 * levels plus the latest reading of each other tank. Unknown if any is.
 */
export const truckTotals = (
  levels: Pick<RefuelLevels, 'gallonsBefore' | 'gallonsAfter'>,
  otherTanks: readonly (number | null)[]
): { truckGallonsBefore: number | null; truckGallonsAfter: number | null } => {
  if (
    levels.gallonsBefore === null ||
    levels.gallonsAfter === null ||
    otherTanks.some(gallons => gallons === null)
  ) {
    return { truckGallonsBefore: null, truckGallonsAfter: null }
  }
  const rest = otherTanks.reduce<number>(
    (sum, gallons) => sum + (gallons ?? 0),
    0
  )
  return {
    truckGallonsBefore: round2(levels.gallonsBefore + rest),
    truckGallonsAfter: round2(levels.gallonsAfter + rest),
  }
}

export interface EfficiencyRefuel {
  takenAt: Date
  odometerKm: number | null
  gallonsAdded: number
  truckGallonsBefore: number | null
  truckGallonsAfter: number | null
}

/**
 * Real efficiency of one truck by levels (RF-9). Between two refuels with
 * odometer and truck totals: km = odometer₂ − odometer₁ and fuel used =
 * after₁ − before₂ + what refuels without those data added in between.
 * Stretches with no distance or no fuel used are skipped.
 */
export const truckEfficiency = (
  refuels: readonly EfficiencyRefuel[]
): { km: number; gallons: number; kmPerGal: number } | null => {
  const sorted = [...refuels].sort(
    (a, b) => a.takenAt.getTime() - b.takenAt.getTime()
  )
  let km = 0
  let gallons = 0
  let start: EfficiencyRefuel | null = null
  let addedBetween = 0
  for (const refuel of sorted) {
    const anchor =
      refuel.odometerKm !== null &&
      refuel.truckGallonsBefore !== null &&
      refuel.truckGallonsAfter !== null
    if (!anchor) {
      if (start) addedBetween += refuel.gallonsAdded
      continue
    }
    if (
      start?.odometerKm != null &&
      start.truckGallonsAfter !== null &&
      refuel.odometerKm !== null &&
      refuel.truckGallonsBefore !== null
    ) {
      const distance = refuel.odometerKm - start.odometerKm
      const used =
        start.truckGallonsAfter - refuel.truckGallonsBefore + addedBetween
      if (distance > 0 && used > 0) {
        km += distance
        gallons += used
      }
    }
    start = refuel
    addedBetween = 0
  }
  return gallons > 0
    ? {
        km: round2(km),
        gallons: round2(gallons),
        kmPerGal: round2(km / gallons),
      }
    : null
}

export interface CurrencySummary {
  currency: Currency
  total: number
  gallons: number
  liters: number
  perGallon: number
  perLiter: number
}

/** Fuel added and money spent, per currency, never converted (RF-8). */
export const refuelSummary = (
  refuels: readonly {
    currency: Currency
    total: number
    gallonsAdded: number
    litersAdded: number
  }[]
): { gallons: number; liters: number; byCurrency: CurrencySummary[] } => {
  const groups = new Map<
    Currency,
    { total: number; gallons: number; liters: number }
  >()
  let gallons = 0
  let liters = 0
  for (const refuel of refuels) {
    gallons += refuel.gallonsAdded
    liters += refuel.litersAdded
    const group = groups.get(refuel.currency) ?? {
      total: 0,
      gallons: 0,
      liters: 0,
    }
    group.total += refuel.total
    group.gallons += refuel.gallonsAdded
    group.liters += refuel.litersAdded
    groups.set(refuel.currency, group)
  }
  return {
    gallons: round2(gallons),
    liters: round2(liters),
    byCurrency: [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, group]) => ({
        currency,
        total: round2(group.total),
        gallons: round2(group.gallons),
        liters: round2(group.liters),
        perGallon: group.gallons > 0 ? round2(group.total / group.gallons) : 0,
        perLiter: group.liters > 0 ? round2(group.total / group.liters) : 0,
      })),
  }
}
