import { db } from 'services/db'
import { enqueueInvoice, processInvoiceQueue } from 'services/invoiceQueue'

const api = vi.hoisted(() => ({
  uploadInvoice: vi.fn(() =>
    Promise.resolve<'uploaded' | 'discarded'>('uploaded')
  ),
}))
vi.mock('services/cloudRefuels', () => api)

const photo = new Blob(['jpg'], { type: 'image/jpeg' })

beforeEach(async () => {
  await db.pendingInvoices.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

test("uploads only the signed-in user's invoices and empties them from the queue (RF-6)", async () => {
  await enqueueInvoice({ refuelId: 'r1', orgId: 'o', uid: 'luis', photo })
  await enqueueInvoice({ refuelId: 'r2', orgId: 'o', uid: 'ana', photo })

  await expect(processInvoiceQueue('luis')).resolves.toBe(1)
  expect(api.uploadInvoice).toHaveBeenCalledTimes(1)
  expect(api.uploadInvoice).toHaveBeenCalledWith(
    expect.objectContaining({ refuelId: 'r1', uid: 'luis' })
  )
  expect(
    (await db.pendingInvoices.toArray()).map(item => item.refuelId)
  ).toEqual(['r2'])
})

test('a failed upload stays for the next try', async () => {
  api.uploadInvoice.mockRejectedValueOnce(new Error('offline'))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await enqueueInvoice({ refuelId: 'r1', orgId: 'o', uid: 'luis', photo })

  await expect(processInvoiceQueue('luis')).resolves.toBe(0)
  expect(await db.pendingInvoices.count()).toBe(1)
  await expect(processInvoiceQueue('luis')).resolves.toBe(1)
  expect(await db.pendingInvoices.count()).toBe(0)
})

test('without signal it waits, and is not stuck afterwards', async () => {
  await enqueueInvoice({ refuelId: 'r1', orgId: 'o', uid: 'luis', photo })
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  await expect(processInvoiceQueue('luis')).resolves.toBe(0)
  expect(api.uploadInvoice).not.toHaveBeenCalled()
  online.mockReturnValue(true)
  await expect(processInvoiceQueue('luis')).resolves.toBe(1)
})

// Regression: an invoice that can never attach (its refuel was deleted)
// stayed in the queue for good, reported on every start
test('an invoice with nothing left to attach to leaves the queue', async () => {
  await enqueueInvoice({ refuelId: 'r-gone', orgId: 'org-1', uid: 'u1', photo })
  api.uploadInvoice.mockResolvedValueOnce('discarded')

  await expect(processInvoiceQueue('u1')).resolves.toBe(0)
  expect(await db.pendingInvoices.count()).toBe(0)
})
