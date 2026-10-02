import { format } from 'date-fns'
import { KM_PER_MILE } from 'schemas/fleet'
import type { CsvColumn } from 'utils/csv'
import { LITERS_PER_GALLON } from 'utils/refuelMath'

// The columns of the exported files (backend specs/0007 RF-4–RF-6), the
// same with and without an account: what does not apply stays empty.

export interface ExportPlace {
  city: string | null
  state: string | null
  country: string | null
}

export interface ExportRefuel {
  takenAt: Date
  userName: string | null
  tankName: string
  equipmentName: string | null
  gallonsAdded: number
  litersAdded: number
  currency: string
  pricePerGallon: number
  pricePerLiter: number
  total: number
  stationName: string | null
  place: ExportPlace | null
  odometerKm: number | null
  gallonsBefore: number | null
  fillPercentBefore: number | null
  gallonsAfter: number | null
  fillPercentAfter: number | null
  hasInvoice: boolean | null
}

export interface ExportMeasurement {
  takenAt: Date
  userName: string | null
  tankName: string
  equipmentName: string | null
  inches: number
  gallons: number
  liters: number
  fillPercent: number | null
  estimate: { km: number; miles: number; kmPerGal: number } | null
  odometerKm: number | null
  place: ExportPlace | null
  /** Free text: basic-mode and imported measurements. */
  placeText: string | null
}

const round2 = (value: number) => Math.round(value * 100) / 100
const liters = (gallons: number | null) =>
  gallons === null ? null : round2(gallons * LITERS_PER_GALLON)
const miles = (km: number | null) =>
  km === null ? null : Math.round(km / KM_PER_MILE)

const when = <T extends { takenAt: Date }>(): CsvColumn<T>[] => [
  { header: 'Fecha', value: row => format(row.takenAt, 'dd/MM/yyyy') },
  { header: 'Hora', value: row => format(row.takenAt, 'HH:mm') },
]

const who = <
  T extends {
    userName: string | null
    tankName: string
    equipmentName: string | null
  },
>(): CsvColumn<T>[] => [
  { header: 'Registrado por', value: row => row.userName },
  { header: 'Tanque', value: row => row.tankName },
  { header: 'Equipo', value: row => row.equipmentName },
]

const where = <T extends { place: ExportPlace | null }>(): CsvColumn<T>[] => [
  { header: 'Ciudad', value: row => row.place?.city },
  { header: 'Estado o departamento', value: row => row.place?.state },
  { header: 'País', value: row => row.place?.country },
]

const odometer = <
  T extends { odometerKm: number | null },
>(): CsvColumn<T>[] => [
  { header: 'Odómetro (km)', value: row => row.odometerKm },
  { header: 'Odómetro (mi)', value: row => miles(row.odometerKm) },
]

export const REFUEL_COLUMNS: CsvColumn<ExportRefuel>[] = [
  ...when<ExportRefuel>(),
  ...who<ExportRefuel>(),
  { header: 'Cantidad (gal)', value: row => row.gallonsAdded },
  { header: 'Cantidad (litros)', value: row => row.litersAdded },
  { header: 'Moneda', value: row => row.currency },
  { header: 'Precio por galón', value: row => row.pricePerGallon },
  { header: 'Precio por litro', value: row => row.pricePerLiter },
  { header: 'Total', value: row => row.total },
  { header: 'Gasolinera', value: row => row.stationName },
  ...where<ExportRefuel>(),
  ...odometer<ExportRefuel>(),
  { header: 'Antes (gal)', value: row => row.gallonsBefore },
  { header: 'Antes (litros)', value: row => liters(row.gallonsBefore) },
  { header: 'Antes (%)', value: row => row.fillPercentBefore },
  { header: 'Después (gal)', value: row => row.gallonsAfter },
  { header: 'Después (litros)', value: row => liters(row.gallonsAfter) },
  { header: 'Después (%)', value: row => row.fillPercentAfter },
  {
    header: 'Factura',
    value: row =>
      row.hasInvoice === null ? null : row.hasInvoice ? 'sí' : 'no',
  },
]

export const MEASUREMENT_COLUMNS: CsvColumn<ExportMeasurement>[] = [
  ...when<ExportMeasurement>(),
  ...who<ExportMeasurement>(),
  { header: 'Pulgadas', value: row => row.inches },
  { header: 'Galones', value: row => row.gallons },
  { header: 'Litros', value: row => row.liters },
  { header: 'Llenado (%)', value: row => row.fillPercent },
  {
    header: 'Alcance (km)',
    value: row => row.estimate && Math.round(row.estimate.km),
  },
  {
    header: 'Alcance (mi)',
    value: row => row.estimate && Math.round(row.estimate.miles),
  },
  {
    header: 'Rendimiento usado (km/gal)',
    value: row => row.estimate?.kmPerGal,
  },
  ...odometer<ExportMeasurement>(),
  ...where<ExportMeasurement>(),
  { header: 'Lugar', value: row => row.placeText },
]
