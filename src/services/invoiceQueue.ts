// Invoice photos waiting for a connection (backend specs/0006 RF-6). The
// queue lives in IndexedDB (Dexie); uploading loads the Firebase SDK with
// import(), so the basic mode never downloads it.
import { db, type PendingInvoice } from 'services/db'
import { reportError } from 'utils/reportError'

export const enqueueInvoice = async (
  invoice: Omit<PendingInvoice, 'createdAt'>
): Promise<void> => {
  await db.pendingInvoices.put({ ...invoice, createdAt: new Date() })
}

const upload = async (uid: string): Promise<number> => {
  if (!navigator.onLine) return 0
  const pending = await db.pendingInvoices.orderBy('createdAt').toArray()
  const mine = pending.filter(invoice => invoice.uid === uid)
  if (mine.length === 0) return 0
  const { uploadInvoice } = await import('services/cloudRefuels')
  let uploaded = 0
  for (const invoice of mine) {
    try {
      const result = await uploadInvoice(invoice)
      await db.pendingInvoices.delete(invoice.refuelId)
      if (result === 'uploaded') uploaded += 1
    } catch (error) {
      // Kept for the next try (no signal yet, refuel not synced yet…)
      reportError(error, { operation: 'uploadInvoice' })
    }
  }
  return uploaded
}

let running: Promise<number> | null = null

/**
 * Uploads the signed-in user's pending invoices, oldest first. Returns how
 * many went up; the rest stay for the next try. One run at a time.
 */
export const processInvoiceQueue = (uid: string): Promise<number> => {
  // .finally runs after the assignment, even if nothing was awaited
  running ??= upload(uid).finally(() => {
    running = null
  })
  return running
}

export const pendingInvoiceCount = () => db.pendingInvoices.count()
