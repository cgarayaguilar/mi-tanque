import { format } from 'date-fns'
import type { Period } from 'types'
import { slug } from 'utils/csv'

// Shared by both export services and the button (backend specs/0007).

export type ExportKind = 'measurements' | 'refuels'

/** At most this many rows per export (RF-8). */
export const MAX_EXPORT_ROWS = 5000

export interface ExportResult {
  count: number
  /** More rows matched than MAX_EXPORT_ROWS: the newest were exported. */
  truncated: boolean
}

/** With an account, exporting reads the server: it needs a connection. */
export class ExportOfflineError extends Error {
  constructor() {
    super('A connection is needed to export the whole period')
    this.name = 'ExportOfflineError'
  }
}

/** solo-camioneros-rellenos-flota-de-rosa-2026-09-24_2026-10-01.csv (RF-7) */
export const exportFileName = (
  kind: ExportKind,
  period: Period,
  orgName: string | null
) =>
  [
    'solo-camioneros',
    kind === 'refuels' ? 'rellenos' : 'mediciones',
    ...(orgName ? [slug(orgName)] : []),
    `${format(period.start, 'yyyy-MM-dd')}_${format(period.end, 'yyyy-MM-dd')}`,
  ]
    .filter(Boolean)
    .join('-') + '.csv'

/** Saves text as a file in the browser's downloads. */
export const downloadText = (fileName: string, content: string) => {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/csv;charset=utf-8' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers read the URL after the click returns
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}
