import { jsPDF } from 'jspdf'
import { autoTable, type CellHookData, type RowInput } from 'jspdf-autotable'
import { colorTokens } from 'theme/tokens'
import {
  FIRST_MONEY_COLUMN,
  type ReportRow,
  type TripReport,
} from 'utils/tripReport'

// Draws the trips' PDF (backend specs/0040 RF-7). Loaded with import() when
// "PDF" is tapped: jsPDF never reaches the index chunk (RNF-1)

/** Half an inch, in points (RF-7). */
const MARGIN = 36
const PROFIT_COLUMN = FIRST_MONEY_COLUMN + 2
// Printed on white paper: the light colors, whatever the screen's mode
const color = colorTokens.light

/** The report drawn on letter paper, landscape (RF-7). */
export const drawTripReport = (report: TripReport) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'letter',
  })
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  let y = MARGIN

  const line = (
    text: string,
    size: number,
    style: 'bold' | 'normal',
    textColor: string,
    gap: number
  ) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(textColor)
    const lines = doc.splitTextToSize(text, width - 2 * MARGIN) as string[]
    doc.text(lines, MARGIN, y + size)
    y += lines.length * size * 1.25 + gap
  }

  // The heading (RF-3)
  line(report.title, 18, 'bold', color.ink, 2)
  line(report.subtitle, 11, 'normal', color.ink, 4)
  if (report.applied) line(report.applied, 9, 'normal', color.muted, 4)
  for (const summary of report.summary)
    line(summary, 10, 'normal', color.ink, 1)
  line(report.generated, 8, 'normal', color.muted, 8)

  // The rows, with each group's title and subtotal (RF-4, RF-5)
  const body: RowInput[] = []
  const meta: (ReportRow | null)[] = []
  for (const section of report.sections) {
    if (section.title !== null) {
      body.push([
        {
          content: [section.title, section.subtitle]
            .filter(Boolean)
            .join(' · '),
          colSpan: report.head.length,
          styles: { fontStyle: 'bold', fillColor: color.surfaceStrong },
        },
      ])
      meta.push(null)
    }
    for (const row of section.rows) {
      body.push(row.cells)
      meta.push(row)
    }
    for (const row of section.subtotal) {
      body.push(
        row.cells.map(content => ({ content, styles: { fontStyle: 'bold' } }))
      )
      meta.push(row)
    }
  }

  const paint = (data: CellHookData) => {
    if (data.column.index >= FIRST_MONEY_COLUMN)
      data.cell.styles.halign = 'right'
    const row =
      data.section === 'body'
        ? meta[data.row.index]
        : data.section === 'foot'
          ? report.total[data.row.index]
          : null
    if (!row) return
    if (row.cancelled) data.cell.styles.textColor = color.muted
    if (row.losing && data.column.index === PROFIT_COLUMN)
      data.cell.styles.textColor = color.error
  }

  autoTable(doc, {
    startY: y,
    head: [report.head],
    body,
    foot: report.total.map(row => row.cells),
    // The header on every page, the total at the end (RF-7)
    showHead: 'everyPage',
    showFoot: 'lastPage',
    margin: { top: MARGIN, right: MARGIN, bottom: MARGIN + 12, left: MARGIN },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 4,
      // A long name breaks into lines, never cut (RF-7)
      overflow: 'linebreak',
      textColor: color.ink,
      lineColor: color.hairline,
      lineWidth: 0.5,
    },
    headStyles: { fillColor: color.primary, textColor: color.onPrimary },
    footStyles: { fillColor: color.surfaceStrong, textColor: color.ink },
    columnStyles: { 0: { cellWidth: 56 }, 5: { cellWidth: 56 } },
    didParseCell: paint,
  })

  // "Solo Camioneros · Página 2 de 5" at the foot of each page (RF-7)
  const pages = doc.getNumberOfPages()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(color.muted)
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.text(
      `Solo Camioneros · Página ${String(page)} de ${String(pages)}`,
      width - MARGIN,
      height - MARGIN / 2,
      { align: 'right' }
    )
  }

  return doc
}

/** Draws the report and saves it as `fileName` (RF-2). */
export const downloadTripReport = (report: TripReport, fileName: string) => {
  drawTripReport(report).save(fileName)
}
