import { slug, toCsv, type CsvColumn } from 'utils/csv'

interface Row {
  name: string
  amount: number | null
}

const columns: CsvColumn<Row>[] = [
  { header: 'Gasolinera', value: row => row.name },
  { header: 'Total', value: row => row.amount },
]

test('commas, decimal dot, BOM and CRLF for Excel in Central America (RF-2)', () => {
  expect(toCsv(columns, [{ name: 'Puma', amount: 1500.25 }])).toBe(
    '﻿Gasolinera,Total\r\nPuma,1500.25\r\n'
  )
})

test('empty values stay empty; accents are kept as they are', () => {
  expect(toCsv(columns, [{ name: 'León', amount: null }])).toBe(
    '﻿Gasolinera,Total\r\nLeón,\r\n'
  )
})

test('separators, quotes and line breaks go between quotes (RF-2)', () => {
  const csv = toCsv(columns, [
    { name: 'Uno, Masaya', amount: 1 },
    { name: 'El "Rápido"', amount: 2 },
    { name: 'Dos\nlíneas', amount: 3 },
  ])
  expect(csv.split('\r\n').slice(1, 4)).toEqual([
    '"Uno, Masaya",1',
    '"El ""Rápido""",2',
    '"Dos\nlíneas",3',
  ])
})

test('text that Excel would run as a formula gets an apostrophe (RF-3, CA-3)', () => {
  const csv = toCsv(columns, [
    { name: '=HYPERLINK("x")', amount: 1 },
    { name: '+50588887777', amount: 2 },
    { name: '-1', amount: -3 },
    { name: '@SUM(A1)', amount: 4 },
  ])
  expect(csv.split('\r\n').slice(1, 5)).toEqual([
    '"\'=HYPERLINK(""x"")",1',
    "'+50588887777,2",
    // A negative amount is a number, not text: no apostrophe
    "'-1,-3",
    "'@SUM(A1),4",
  ])
})

test('file names use a plain slug (RF-7)', () => {
  expect(slug('Flota de Peña & Hijos ')).toBe('flota-de-pena-hijos')
})
