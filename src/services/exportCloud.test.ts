import { exportCloudHistory } from 'services/exportCloud'
import type * as ExportFile from 'utils/exportFile'
import { ExportOfflineError, MAX_EXPORT_ROWS } from 'utils/exportFile'
import { cloudMeasurement } from '../testing/fleetFixtures'

const measurementsApi = vi.hoisted(() => ({ readHistoryPage: vi.fn() }))
vi.mock('services/cloudMeasurements', () => measurementsApi)
const refuelsApi = vi.hoisted(() => ({ readRefuelsPage: vi.fn() }))
vi.mock('services/cloudRefuels', () => refuelsApi)

const files = vi.hoisted(() => ({
  downloads: [] as { name: string; csv: string }[],
}))
vi.mock('utils/exportFile', async importOriginal => ({
  ...(await importOriginal<typeof ExportFile>()),
  downloadText: (name: string, csv: string) => {
    files.downloads.push({ name, csv })
  },
}))

const period = {
  start: new Date(2026, 8, 24),
  end: new Date(2026, 9, 1, 23, 59),
}
const request = {
  period,
  orgId: 'org-a',
  orgName: 'Flota de Rosa',
  equipmentId: 'truck-1',
}

beforeEach(() => {
  files.downloads.length = 0
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

test('reads every page of the period and filter, 500 at a time (RF-8, CA-4)', async () => {
  const cursor = { id: 'c' }
  measurementsApi.readHistoryPage
    .mockResolvedValueOnce({
      items: Array.from({ length: 500 }, (_, n) =>
        cloudMeasurement({ id: `a${String(n)}` })
      ),
      cursor,
    })
    .mockResolvedValueOnce({
      items: [cloudMeasurement({ id: 'last' })],
      cursor: null,
    })

  await expect(
    exportCloudHistory({ kind: 'measurements', ...request })
  ).resolves.toEqual({ count: 501, truncated: false })
  expect(measurementsApi.readHistoryPage).toHaveBeenNthCalledWith(2, {
    orgId: 'org-a',
    start: period.start,
    end: period.end,
    equipmentId: 'truck-1',
    after: cursor,
    pageSize: 500,
  })
  const [file] = files.downloads
  expect(file?.name).toBe(
    'solo-camioneros-mediciones-flota-de-rosa-2026-09-24_2026-10-01.csv'
  )
  expect(file?.csv.split('\r\n')).toHaveLength(1 + 501 + 1)
  expect(file?.csv).toContain(
    ',Luis,Tanque izquierdo,Unidad 12,12,70.5,266.87,52.2,670,416,9.5,,,,120500,74875,Managua,Managua,Nicaragua,'
  )
})

test(`stops at ${String(MAX_EXPORT_ROWS)} rows, the newest, and says so (RF-8)`, async () => {
  const page = Array.from({ length: 500 }, (_, n) =>
    cloudMeasurement({ id: String(n) })
  )
  measurementsApi.readHistoryPage.mockResolvedValue({
    items: page,
    cursor: { id: 'more' },
  })
  await expect(
    exportCloudHistory({ kind: 'measurements', ...request })
  ).resolves.toEqual({ count: MAX_EXPORT_ROWS, truncated: true })
  expect(measurementsApi.readHistoryPage).toHaveBeenCalledTimes(10)
})

test('offline it refuses instead of exporting part of the period (RF-8)', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  await expect(
    exportCloudHistory({ kind: 'refuels', ...request })
  ).rejects.toBeInstanceOf(ExportOfflineError)
  expect(refuelsApi.readRefuelsPage).not.toHaveBeenCalled()
  expect(files.downloads).toHaveLength(0)
})

test('nothing in the period downloads nothing', async () => {
  refuelsApi.readRefuelsPage.mockResolvedValue({ items: [], cursor: null })
  await expect(
    exportCloudHistory({ kind: 'refuels', ...request })
  ).resolves.toEqual({
    count: 0,
    truncated: false,
  })
  expect(files.downloads).toHaveLength(0)
})
