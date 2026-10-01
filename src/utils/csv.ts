// CSV for Excel with Central American settings (backend specs/0007 RF-2,
// RF-3): commas between columns, decimal dot, UTF-8 with BOM and CRLF. Pure:
// no download here.

export type CsvCell = string | number | null | undefined

export interface CsvColumn<T> {
  header: string
  value: (row: T) => CsvCell
}

const BOM = '﻿'
const SEPARATOR = ','
const NEEDS_QUOTES = /[,"\r\n]/
// Excel runs a cell that starts with these as a formula (CSV injection)
const FORMULA_START = /^[=+\-@\t\r]/

/** A number Excel reads as a number: decimal dot, no thousands commas. */
const formatNumber = (value: number) =>
  Number.isFinite(value) ? String(value) : ''

const formatText = (value: string) => {
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

const formatCell = (value: CsvCell) => {
  if (value === null || value === undefined) return ''
  return typeof value === 'number' ? formatNumber(value) : formatText(value)
}

/** The whole file: header row, one row per item, ready to download. */
export const toCsv = <T>(
  columns: readonly CsvColumn<T>[],
  rows: readonly T[]
): string => {
  const lines = [
    columns.map(column => formatText(column.header)).join(SEPARATOR),
    ...rows.map(row =>
      columns.map(column => formatCell(column.value(row))).join(SEPARATOR)
    ),
  ]
  return `${BOM}${lines.join('\r\n')}\r\n`
}

/** "Flota de Rosa" → "flota-de-rosa" (RF-7). */
export const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
