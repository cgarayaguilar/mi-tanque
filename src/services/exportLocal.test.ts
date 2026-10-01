import { db } from 'services/db'
import type * as ExportFile from 'utils/exportFile'
import { exportLocalHistory } from 'services/exportLocal'

const files = vi.hoisted(() => ({
  downloads: [] as { name: string; csv: string }[],
}))
vi.mock('utils/exportFile', async importOriginal => ({
  ...(await importOriginal<typeof ExportFile>()),
  downloadText: (name: string, csv: string) => {
    files.downloads.push({ name, csv })
  },
}))

const DAY = 24 * 60 * 60 * 1000
const period = { start: new Date(Date.now() - 7 * DAY), end: new Date() }

beforeEach(async () => {
  files.downloads.length = 0
  await db.tanks.clear()
  await db.measurements.clear()
  await db.refuels.clear()
})

test("exports this phone's measurements, newest first, without account columns (RF-6)", async () => {
  const tankId = await db.tanks.add({ capacity: 50, diameter: 25, length: 26 })
  await db.measurements.bulkAdd([
    {
      date: new Date(Date.now() - 2 * DAY),
      inches: 10,
      gallons: '20.00',
      liters: '75.71',
      location: 'León, Nicaragua',
      tankId,
    },
    {
      date: new Date(Date.now() - DAY),
      inches: 12,
      gallons: '26.22',
      liters: '99.25',
      location: 'Sin ubicación',
      tankId,
    },
  ])
  await expect(
    exportLocalHistory({ kind: 'measurements', period })
  ).resolves.toEqual({
    count: 2,
    truncated: false,
  })
  const rows = files.downloads[0]?.csv.split('\r\n') ?? []
  expect(files.downloads[0]?.name).toMatch(
    /^solo-camioneros-mediciones-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/
  )
  expect(rows[1]).toContain(';;Tanque de 50 gal;;12;26,22;99,25;')
  expect(rows[1]?.endsWith(';')).toBe(true)
  expect(rows[2]?.endsWith(';León, Nicaragua')).toBe(true)
})

test('exports the refuels saved without an account', async () => {
  const tankId = await db.tanks.add({ capacity: 50, diameter: 25, length: 26 })
  await db.refuels.add({
    intentId: 'i',
    date: new Date(Date.now() - DAY),
    tankId,
    gallonsAdded: 13.21,
    litersAdded: 50,
    quantityUnit: 'liter',
    currency: 'NIO',
    priceUnit: 'liter',
    pricePerGallon: 113.56,
    pricePerLiter: 30,
    total: 1500,
    inchesBefore: null,
    inchesAfter: null,
    gallonsBefore: null,
    gallonsAfter: null,
    fillPercentBefore: null,
    fillPercentAfter: null,
    stationName: '=cmd',
  })
  await exportLocalHistory({ kind: 'refuels', period })
  const row = files.downloads[0]?.csv.split('\r\n')[1]
  expect(row).toContain(
    ";;Tanque de 50 gal;;13,21;50;NIO;113,56;30;1500;'=cmd;"
  )
  // Not applicable without an account: empty, not "no"
  expect(row?.endsWith(';')).toBe(true)
})
