// Exporting what this phone saved without an account (backend specs/0007
// RF-6). Dexie only: never downloads the Firebase SDK.
import { readLocalRefuelsInPeriod } from 'services/localRefuels'
import { readMeasurementsInPeriod } from 'services/measurements'
import { readTanks } from 'services/tanks'
import type { Period, Tank } from 'types'
import { toCsv } from 'utils/csv'
import {
  MEASUREMENT_COLUMNS,
  REFUEL_COLUMNS,
  type ExportMeasurement,
  type ExportRefuel,
} from 'utils/exportColumns'
import {
  downloadText,
  exportFileName,
  MAX_EXPORT_ROWS,
  type ExportKind,
  type ExportResult,
} from 'utils/exportFile'
import { volumePercent } from 'utils/fuelReading'

// Same text the basic mode stores when the GPS did not answer
const NO_LOCATION = 'Sin ubicación'

const tankName = (tank: Tank | undefined) =>
  tank ? `Tanque de ${String(tank.capacity)} gal` : 'Tanque borrado'

const limit = <T>(items: T[]) => ({
  items: items.slice(0, MAX_EXPORT_ROWS),
  truncated: items.length > MAX_EXPORT_ROWS,
})

export const exportLocalHistory = async ({
  kind,
  period,
}: {
  kind: ExportKind
  period: Period
}): Promise<ExportResult> => {
  const tanks = new Map((await readTanks()).map(tank => [tank.id, tank]))
  let csv: string
  let result: ExportResult

  if (kind === 'refuels') {
    const { items, truncated } = limit(await readLocalRefuelsInPeriod(period))
    const rows: ExportRefuel[] = items.map(refuel => ({
      ...refuel,
      takenAt: new Date(refuel.date),
      userName: null,
      tankName: tankName(tanks.get(refuel.tankId)),
      equipmentName: null,
      place: null,
      odometerKm: null,
      hasInvoice: null,
    }))
    csv = toCsv(REFUEL_COLUMNS, rows)
    result = { count: rows.length, truncated }
  } else {
    // Stored oldest first: newest first, like the cloud
    const measurements = (await readMeasurementsInPeriod(period)).reverse()
    const { items, truncated } = limit(measurements)
    const rows: ExportMeasurement[] = items.map(measurement => {
      const tank = tanks.get(measurement.tankId)
      const gallons = Number(measurement.gallons)
      return {
        takenAt: new Date(measurement.date),
        userName: null,
        tankName: tankName(tank),
        equipmentName: null,
        inches: measurement.inches,
        gallons,
        liters: Number(measurement.liters),
        // By volume from the inches and the tank's shape, like the screen
        // (specs/0018 RF-1, specs/0019 RF-10): the stored gallons are
        // adjusted to the capacity, its geometry's volume is not
        fillPercent: tank
          ? Math.round(volumePercent(tank, measurement.inches) * 100) / 100
          : null,
        estimate: null,
        odometerKm: null,
        place: null,
        placeText:
          measurement.location && measurement.location !== NO_LOCATION
            ? measurement.location
            : null,
      }
    })
    csv = toCsv(MEASUREMENT_COLUMNS, rows)
    result = { count: rows.length, truncated }
  }
  if (result.count > 0) downloadText(exportFileName(kind, period, null), csv)
  return result
}
