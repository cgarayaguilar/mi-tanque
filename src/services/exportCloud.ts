// Exporting the organization's history (backend specs/0007). Imports the
// Firebase services: only reached with import() from the signed-in history.
import type { QueryDocumentSnapshot } from 'firebase/firestore'
import {
  readHistoryPage,
  type CloudMeasurement,
} from 'services/cloudMeasurements'
import { readRefuelsPage, type CloudRefuel } from 'services/cloudRefuels'
import type { Period } from 'types'
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
  ExportOfflineError,
  MAX_EXPORT_ROWS,
  type ExportKind,
  type ExportResult,
} from 'utils/exportFile'

const PAGE_SIZE = 500

/** Every page of the period up to the limit, newest first (RF-8). */
const readAll = async <T>(
  read: (after: QueryDocumentSnapshot | null) => Promise<{
    items: T[]
    cursor: QueryDocumentSnapshot | null
  }>
): Promise<{ items: T[]; truncated: boolean }> => {
  const items: T[] = []
  let after: QueryDocumentSnapshot | null = null
  for (;;) {
    const page = await read(after)
    items.push(...page.items)
    if (!page.cursor) return { items, truncated: false }
    if (items.length >= MAX_EXPORT_ROWS) {
      return { items: items.slice(0, MAX_EXPORT_ROWS), truncated: true }
    }
    after = page.cursor
  }
}

const placeOf = (place: CloudRefuel['place']) =>
  place && { city: place.city, state: place.state, country: place.country }

const toRefuelRow = (refuel: CloudRefuel): ExportRefuel => ({
  ...refuel,
  equipmentName: refuel.equipment.name,
  place: placeOf(refuel.place),
  hasInvoice: refuel.invoicePhotoPath !== null,
})

const toMeasurementRow = (
  measurement: CloudMeasurement
): ExportMeasurement => ({
  ...measurement,
  equipmentName: measurement.equipment.name,
  place: placeOf(measurement.place),
  placeText: measurement.legacyPlace,
})

export const exportCloudHistory = async ({
  kind,
  period,
  orgId,
  orgName,
  equipmentId,
}: {
  kind: ExportKind
  period: Period
  orgId: string
  orgName: string
  equipmentId: string | null
}): Promise<ExportResult> => {
  // Offline, the cache could hold part of the period: never a partial file
  if (!navigator.onLine) throw new ExportOfflineError()
  const query = (after: QueryDocumentSnapshot | null) => ({
    orgId,
    start: period.start,
    end: period.end,
    equipmentId,
    after,
    pageSize: PAGE_SIZE,
  })

  let csv: string
  let result: ExportResult
  if (kind === 'refuels') {
    const { items, truncated } = await readAll(after =>
      readRefuelsPage(query(after))
    )
    csv = toCsv(REFUEL_COLUMNS, items.map(toRefuelRow))
    result = { count: items.length, truncated }
  } else {
    const { items, truncated } = await readAll(after =>
      readHistoryPage(query(after))
    )
    csv = toCsv(MEASUREMENT_COLUMNS, items.map(toMeasurementRow))
    result = { count: items.length, truncated }
  }
  if (result.count > 0) downloadText(exportFileName(kind, period, orgName), csv)
  return result
}
