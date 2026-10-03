// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import {
  checkTankMeasures,
  TANK_ORIENTATION_LABELS,
  TANK_SHAPE_LABELS,
  tankGeometryFromForm,
  tankMeasureFields,
  type TankMeasureLimits,
} from 'schemas/tankMeasures'
import { matchBrand, matchModel } from 'data/truckModels'
import type { TankOrientation } from 'utils/tankVolume'
import { formatEditable, formatNumber } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'
import { isPlainDate } from 'utils/plainDate'

// Same lists and limits as solocamioneros-backend/firestore.rules (specs/0003)

export const KM_PER_MILE = 1.609344

export const COLOR_SWATCHES = [
  { id: 'white', label: 'Blanco' },
  { id: 'black', label: 'Negro' },
  { id: 'silver', label: 'Plata' },
  { id: 'gray', label: 'Gris' },
  { id: 'red', label: 'Rojo' },
  { id: 'blue', label: 'Azul' },
  { id: 'green', label: 'Verde' },
  { id: 'yellow', label: 'Amarillo' },
  { id: 'orange', label: 'Naranja' },
  { id: 'brown', label: 'Café' },
  { id: 'beige', label: 'Beige' },
] as const
export type Swatch = (typeof COLOR_SWATCHES)[number]['id'] | 'other'

export interface VehicleColor {
  swatch: Swatch
  /** The palette's name, or what the user wrote for "other". */
  label: string
}

export const TRAILER_TYPES = [
  { id: 'dry', label: 'Seco (caja cerrada)' },
  { id: 'reefer', label: 'Refrigerado' },
  { id: 'tanker', label: 'Cisterna' },
  { id: 'flatbed', label: 'Plataforma' },
  { id: 'other', label: 'Otro' },
] as const
export type TrailerType = (typeof TRAILER_TYPES)[number]['id']

export type DistanceUnit = 'km' | 'mi'

export { TANK_ORIENTATION_LABELS, TANK_SHAPE_LABELS }

export const FLEET_LIMITS = {
  name: 40,
  plate: 15,
  brandModel: 30,
  vin: 25,
  description: 500,
  colorLabel: 30,
  trailerTypeOther: 30,
  yearMin: 1950,
  efficiency: { min: 0.5, max: 50 },
  odometerMax: 5_000_000,
  lengthFt: { min: 10, max: 60 },
  reefer: { min: 0.1, max: 5 },
  section: { min: 5, max: 200 },
  tankLength: { min: 5, max: 600 },
  capacity: { min: 10, max: 2000 },
} as const

/** The fleet's limits for a tank's measures (specs/0003). */
const FLEET_TANK_LIMITS: TankMeasureLimits = {
  capacity: FLEET_LIMITS.capacity,
  section: FLEET_LIMITS.section,
  length: FLEET_LIMITS.tankLength,
}

// ---- Stored documents (what the app reads and writes) --------------------

interface FleetItemBase {
  id: string
  orgId: string
  name: string
  description: string | null
  photoPath: string | null
  archived: boolean
}

interface VehicleFields {
  plate: string | null
  brand: string | null
  model: string | null
  year: number | null
  color: VehicleColor | null
  vin: string | null
  /** The insurance's expiry, 'YYYY-MM-DD' (backend specs/0011). */
  insuranceExpiresOn: string | null
}

export interface Truck extends FleetItemBase, VehicleFields {
  distanceUnit: DistanceUnit
  fuelEfficiencyKmPerGal: number | null
  odometerKm: number | null
  assignedDriverUid: string | null
}

export interface Trailer extends FleetItemBase, VehicleFields {
  trailerType: TrailerType
  trailerTypeOther: string | null
  lengthFt: number | null
  reeferConsumptionGalPerHour: number | null
  hitchedTruckId: string | null
}

export type TankEquipment =
  { kind: 'none'; id: null } | { kind: 'truck' | 'trailer'; id: string }

/** Written only by the measurements trigger (backend specs/0004 RF-7). */
export interface LastMeasurement {
  id: string
  takenAt: Date
  gallons: number
  fillPercent: number
}

export type FleetTank = FleetItemBase & {
  equipment: TankEquipment
  capacityGal: number
  templateId: string | null
  lastMeasurement: LastMeasurement | null
} & (
    | {
        shape: 'cylinder'
        orientation: TankOrientation
        dimensions: { diameterIn: number; lengthIn: number }
      }
    | {
        shape: 'rectangular' | 'd_flat_side' | 'd_flat_bottom'
        orientation: TankOrientation
        dimensions: { heightIn: number; widthIn: number; lengthIn: number }
      }
  )

// ---- Form fields ---------------------------------------------------------

const requiredText = (missing: string, max: number) =>
  z
    .string()
    .check(
      z.trim(),
      z.minLength(1, { error: missing, abort: true }),
      z.maxLength(max, { error: `Usa ${String(max)} caracteres como máximo` })
    )

const optionalText = (max: number) =>
  z
    .string()
    .check(
      z.trim(),
      z.maxLength(max, { error: `Usa ${String(max)} caracteres como máximo` })
    )

/** "" means not given; otherwise a decimal ("12.5", "1,500") in range. */
const optionalDecimal = (min: number, max: number, unit: string) =>
  z.string().check(
    z.trim(),
    z.refine(value => value === '' || !Number.isNaN(parseDecimal(value)), {
      error: 'Escribe solo números, por ejemplo 12.5',
      abort: true,
    }),
    z.refine(
      value =>
        value === '' ||
        (parseDecimal(value) >= min && parseDecimal(value) <= max),
      {
        error: `Debe estar entre ${formatNumber(min)} y ${formatNumber(max)} ${unit}`,
      }
    )
  )

const optionalYear = z.string().check(
  z.trim(),
  z.refine(
    value => {
      if (value === '') return true
      const year = Number(value)
      return (
        /^\d{4}$/.test(value) &&
        year >= FLEET_LIMITS.yearMin &&
        year <= new Date().getFullYear() + 1
      )
    },
    { error: 'Escribe un año de 4 números, por ejemplo 2019' }
  )
)

/**
 * A field shown only in some cases, checked only then: a value left behind
 * when it hides (a reefer's consumption, then "Seco") blocked the save with
 * no visible error (audit 2026-10-02). What is saved already drops it.
 */
const checkWhen = <T extends Record<string, unknown>>(
  applies: (values: T) => boolean,
  field: keyof T & string,
  schema: z.ZodMiniType
) =>
  z.superRefine<T>((values, ctx) => {
    if (!applies(values)) return
    const result = schema.safeParse(values[field])
    if (result.success) return
    for (const issue of result.error.issues) {
      ctx.issues.push({
        code: 'custom',
        input: values[field],
        path: [field],
        message: issue.message,
      })
    }
  })

const colorFields = {
  colorSwatch: z.string(),
  // Checked only with "Otro" (checkWhen)
  colorOther: z.string(),
}

const vehicleFields = {
  name: requiredText('Escribe el nombre o número de unidad', FLEET_LIMITS.name),
  plate: optionalText(FLEET_LIMITS.plate),
  brand: optionalText(FLEET_LIMITS.brandModel),
  model: optionalText(FLEET_LIMITS.brandModel),
  year: optionalYear,
  vin: optionalText(FLEET_LIMITS.vin),
  description: optionalText(FLEET_LIMITS.description),
  // '' or 'YYYY-MM-DD', from the date picker (specs/0011 RF-3)
  insuranceExpiresOn: z.string().check(
    z.refine(value => value === '' || isPlainDate(value), {
      error: 'Escribe una fecha válida',
    })
  ),
  ...colorFields,
}

const otherColorFits = checkWhen<{ colorSwatch: string; colorOther: string }>(
  values => values.colorSwatch === 'other',
  'colorOther',
  optionalText(FLEET_LIMITS.colorLabel)
)

const otherColorNeedsName = z.refine<{
  colorSwatch: string
  colorOther: string
}>(
  values => values.colorSwatch !== 'other' || values.colorOther.trim() !== '',
  { error: 'Escribe el color', path: ['colorOther'] }
)

/** "Otra marca…" / "Otro modelo…": then it is written (specs/0016 RF-2). */
export const OTHER_CHOICE = 'other'

export const truckFormSchema = z
  .object({
    ...vehicleFields,
    // From the list, '' or OTHER_CHOICE (then `brand` / `model` is typed)
    brandChoice: z.string(),
    modelChoice: z.string(),
    efficiency: optionalDecimal(
      FLEET_LIMITS.efficiency.min,
      FLEET_LIMITS.efficiency.max,
      'por galón'
    ),
    odometer: optionalDecimal(0, FLEET_LIMITS.odometerMax, ''),
    assignedDriverUid: z.string(),
  })
  .check(
    otherColorNeedsName,
    otherColorFits,
    z.refine(
      values =>
        values.brandChoice !== OTHER_CHOICE || values.brand.trim() !== '',
      { error: 'Escribe la marca', path: ['brand'] }
    ),
    z.refine(
      values =>
        values.modelChoice !== OTHER_CHOICE || values.model.trim() !== '',
      { error: 'Escribe el modelo', path: ['model'] }
    )
  )
export type TruckFormValues = z.infer<typeof truckFormSchema>

export const trailerFormSchema = z
  .object({
    ...vehicleFields,
    trailerType: z.enum(['dry', 'reefer', 'tanker', 'flatbed', 'other']),
    // Checked only for that type (checkWhen)
    trailerTypeOther: z.string(),
    lengthFt: optionalDecimal(
      FLEET_LIMITS.lengthFt.min,
      FLEET_LIMITS.lengthFt.max,
      'pies'
    ),
    reeferConsumption: z.string(),
    hitchedTruckId: z.string(),
  })
  .check(
    otherColorNeedsName,
    otherColorFits,
    checkWhen<{ trailerType: string; trailerTypeOther: string }>(
      values => values.trailerType === 'other',
      'trailerTypeOther',
      optionalText(FLEET_LIMITS.trailerTypeOther)
    ),
    checkWhen<{ trailerType: string; reeferConsumption: string }>(
      values => values.trailerType === 'reefer',
      'reeferConsumption',
      optionalDecimal(FLEET_LIMITS.reefer.min, FLEET_LIMITS.reefer.max, 'gal/h')
    ),
    z.refine(
      values =>
        values.trailerType !== 'other' || values.trailerTypeOther.trim() !== '',
      { error: 'Escribe el tipo de remolque', path: ['trailerTypeOther'] }
    )
  )
export type TrailerFormValues = z.infer<typeof trailerFormSchema>

export const tankFormSchema = z
  .object({
    name: requiredText('Escribe el nombre del tanque', FLEET_LIMITS.name),
    templateId: z.string(),
    ...tankMeasureFields(FLEET_TANK_LIMITS),
    equipment: z.string(),
    description: optionalText(FLEET_LIMITS.description),
  })
  .check(checkTankMeasures(FLEET_TANK_LIMITS))
export type TankFormValues = z.infer<typeof tankFormSchema>

// ---- Mappers between forms and documents ---------------------------------

const textOrNull = (value: string) => value.trim() || null
const decimalOrNull = (value: string) =>
  value.trim() === '' ? null : parseDecimal(value)
const show = (value: number | null) =>
  value === null ? '' : formatEditable(value)

const colorFrom = (swatch: string, other: string): VehicleColor | null => {
  if (swatch === '') return null
  if (swatch === 'other') return { swatch: 'other', label: other.trim() }
  const match = COLOR_SWATCHES.find(color => color.id === swatch)
  return match ? { swatch: match.id, label: match.label } : null
}

const colorToForm = (color: VehicleColor | null) => ({
  colorSwatch: color?.swatch ?? '',
  colorOther: color?.swatch === 'other' ? color.label : '',
})

const vehicleFromForm = (values: TruckFormValues | TrailerFormValues) => ({
  name: values.name.trim(),
  plate: textOrNull(values.plate),
  brand: textOrNull(values.brand),
  model: textOrNull(values.model),
  year: values.year.trim() === '' ? null : Number(values.year),
  color: colorFrom(values.colorSwatch, values.colorOther),
  vin: textOrNull(values.vin),
  description: textOrNull(values.description),
  insuranceExpiresOn: values.insuranceExpiresOn || null,
})

const vehicleToForm = (item: Truck | Trailer) => ({
  name: item.name,
  plate: item.plate ?? '',
  brand: item.brand ?? '',
  model: item.model ?? '',
  year: item.year === null ? '' : String(item.year),
  vin: item.vin ?? '',
  description: item.description ?? '',
  // A stored date that does not exist (e.g. 2026-02-30, written outside the
  // app) would leave the field looking empty but unsaveable (audit 2026-10-02)
  insuranceExpiresOn:
    item.insuranceExpiresOn && isPlainDate(item.insuranceExpiresOn)
      ? item.insuranceExpiresOn
      : '',
  ...colorToForm(item.color),
})

/**
 * Truck fields from the form, typed in the organization's unit and stored in
 * km (specs/0003 RF-5). The truck keeps that unit in `distanceUnit`, which
 * the rules still ask for (backend specs/0010 RF-4).
 */
export const truckFromForm = (values: TruckFormValues, unit: DistanceUnit) => {
  const toKm = unit === 'mi' ? KM_PER_MILE : 1
  const efficiency = decimalOrNull(values.efficiency)
  const odometer = decimalOrNull(values.odometer)
  return {
    ...vehicleFromForm(values),
    ...brandAndModel(values),
    distanceUnit: unit,
    fuelEfficiencyKmPerGal: efficiency === null ? null : efficiency * toKm,
    // Whole kilometers: an odometer has no use for fractions
    odometerKm: odometer === null ? null : Math.round(odometer * toKm),
    assignedDriverUid: values.assignedDriverUid || null,
  }
}

/**
 * The brand and model to save (specs/0016 RF-4): the list's name, the typed
 * one with "Otra…", or none.
 */
const brandAndModel = (values: TruckFormValues) => {
  const listedBrand =
    values.brandChoice !== '' && values.brandChoice !== OTHER_CHOICE
  const brand = listedBrand
    ? values.brandChoice
    : values.brandChoice === OTHER_CHOICE
      ? textOrNull(values.brand)
      : null
  // With a brand of the list the model is chosen; otherwise it is typed
  const model = !listedBrand
    ? textOrNull(values.model)
    : values.modelChoice === OTHER_CHOICE
      ? textOrNull(values.model)
      : values.modelChoice || null
  return { brand, model }
}

/** A stored brand and model as the form shows them (specs/0016 RF-5). */
const brandAndModelToForm = (brand: string | null, model: string | null) => {
  const listedBrand = matchBrand(brand)
  if (!listedBrand)
    return {
      brandChoice: brand ? OTHER_CHOICE : '',
      brand: brand ?? '',
      modelChoice: '',
      model: model ?? '',
    }
  const listedModel = matchModel(listedBrand, model)
  return {
    brandChoice: listedBrand,
    brand: '',
    modelChoice: listedModel ?? (model ? OTHER_CHOICE : ''),
    model: listedModel ? '' : (model ?? ''),
  }
}

/** The truck back in the form, in the organization's unit. */
export const truckToForm = (
  truck: Truck | null,
  unit: DistanceUnit
): TruckFormValues => {
  const fromKm = unit === 'mi' ? 1 / KM_PER_MILE : 1
  return {
    ...(truck
      ? vehicleToForm(truck)
      : {
          name: '',
          plate: '',
          brand: '',
          model: '',
          year: '',
          vin: '',
          description: '',
          colorSwatch: '',
          colorOther: '',
          insuranceExpiresOn: '',
        }),
    efficiency: show(
      truck?.fuelEfficiencyKmPerGal == null
        ? null
        : truck.fuelEfficiencyKmPerGal * fromKm
    ),
    odometer: show(
      truck?.odometerKm == null ? null : Math.round(truck.odometerKm * fromKm)
    ),
    ...brandAndModelToForm(truck?.brand ?? null, truck?.model ?? null),
    assignedDriverUid: truck?.assignedDriverUid ?? '',
  }
}

export const trailerFromForm = (values: TrailerFormValues) => ({
  ...vehicleFromForm(values),
  trailerType: values.trailerType,
  trailerTypeOther:
    values.trailerType === 'other' ? values.trailerTypeOther.trim() : null,
  lengthFt: decimalOrNull(values.lengthFt),
  reeferConsumptionGalPerHour:
    values.trailerType === 'reefer'
      ? decimalOrNull(values.reeferConsumption)
      : null,
  hitchedTruckId: values.hitchedTruckId || null,
})

export const trailerToForm = (trailer: Trailer | null): TrailerFormValues => ({
  ...(trailer
    ? vehicleToForm(trailer)
    : {
        name: '',
        plate: '',
        brand: '',
        model: '',
        year: '',
        vin: '',
        description: '',
        colorSwatch: '',
        colorOther: '',
        insuranceExpiresOn: '',
      }),
  trailerType: trailer?.trailerType ?? 'dry',
  trailerTypeOther: trailer?.trailerTypeOther ?? '',
  lengthFt: show(trailer?.lengthFt ?? null),
  reeferConsumption: show(trailer?.reeferConsumptionGalPerHour ?? null),
  hitchedTruckId: trailer?.hitchedTruckId ?? '',
})

/** "truck:ID", "trailer:ID" or "none" in the form's single select. */
export const equipmentToValue = (equipment: TankEquipment) =>
  equipment.kind === 'none' ? 'none' : `${equipment.kind}:${equipment.id}`

export const equipmentFromValue = (value: string): TankEquipment => {
  const [kind, id] = value.split(':')
  if ((kind === 'truck' || kind === 'trailer') && id) return { kind, id }
  return { kind: 'none', id: null }
}

export { tankGeometryFromForm }

export const tankFromForm = (values: TankFormValues) => ({
  name: values.name.trim(),
  ...tankGeometryFromForm(values),
  capacityGal: parseDecimal(values.capacity),
  equipment: equipmentFromValue(values.equipment),
  templateId: values.templateId || null,
  description: textOrNull(values.description),
})

export const tankToForm = (tank: FleetTank | null): TankFormValues => {
  const base = {
    name: tank?.name ?? '',
    templateId: tank?.templateId ?? '',
    shape: tank?.shape ?? ('cylinder' as const),
    orientation: tank?.orientation ?? ('horizontal' as const),
    diameter: '',
    height: '',
    width: '',
    length: '',
    capacity: tank ? show(tank.capacityGal) : '',
    equipment: tank ? equipmentToValue(tank.equipment) : 'none',
    description: tank?.description ?? '',
  }
  if (!tank) return base
  if (tank.shape === 'cylinder') {
    return {
      ...base,
      diameter: show(tank.dimensions.diameterIn),
      length: show(tank.dimensions.lengthIn),
    }
  }
  return {
    ...base,
    height: show(tank.dimensions.heightIn),
    width: show(tank.dimensions.widthIn),
    length: show(tank.dimensions.lengthIn),
  }
}
