import { uploadInvoice } from 'services/cloudRefuels'

const sdk = vi.hoisted(() => ({
  refuel: null as { invoicePhotoPath: string | null } | null,
  storedPhoto: false,
  getDoc: vi.fn(() =>
    Promise.resolve({
      exists: () => sdk.refuel !== null,
      get: (field: 'invoicePhotoPath') => sdk.refuel?.[field],
    })
  ),
  updateDoc: vi.fn(() => Promise.resolve()),
  getMetadata: vi.fn(() =>
    sdk.storedPhoto
      ? Promise.resolve({})
      : Promise.reject(
          Object.assign(new Error('missing'), {
            code: 'storage/object-not-found',
          })
        )
  ),
  uploadBytes: vi.fn(() => Promise.resolve()),
}))

vi.mock('firebase/firestore', async importOriginal => ({
  ...(await importOriginal<object>()),
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  getDoc: sdk.getDoc,
  updateDoc: sdk.updateDoc,
  serverTimestamp: () => 'now',
}))
vi.mock('firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => path,
  getMetadata: sdk.getMetadata,
  uploadBytes: sdk.uploadBytes,
}))
vi.mock('services/firebase', () => ({
  loadFirebase: () => Promise.resolve({ db: 'db' }),
  loadStorage: () => Promise.resolve('storage'),
}))

const invoice = {
  orgId: 'org-1',
  refuelId: 'r1',
  uid: 'u1',
  photo: new Blob(['jpg'], { type: 'image/jpeg' }),
}
const path = 'orgs/org-1/refuels/r1/invoice.jpg'

beforeEach(() => {
  sdk.refuel = { invoicePhotoPath: null }
  sdk.storedPhoto = false
  vi.clearAllMocks()
})

test('uploads the photo and points the refuel at it', async () => {
  await expect(uploadInvoice(invoice)).resolves.toBe('uploaded')
  expect(sdk.uploadBytes).toHaveBeenCalledWith(path, invoice.photo, {
    contentType: 'image/jpeg',
  })
  expect(sdk.updateDoc).toHaveBeenCalledWith('refuels/r1', {
    invoicePhotoPath: path,
    updatedAt: 'now',
    updatedBy: 'u1',
  })
})

// Regression: the photo went up but the refuel was not updated (app closed,
// no signal); every retry was an overwrite, which the rules forbid, and the
// invoice stayed in the queue forever
test('a photo already up is not sent again: only the refuel is updated', async () => {
  sdk.storedPhoto = true

  await expect(uploadInvoice(invoice)).resolves.toBe('uploaded')
  expect(sdk.uploadBytes).not.toHaveBeenCalled()
  expect(sdk.updateDoc).toHaveBeenCalledTimes(1)
})

test('a refuel that already points at its invoice is done', async () => {
  sdk.refuel = { invoicePhotoPath: path }

  await expect(uploadInvoice(invoice)).resolves.toBe('uploaded')
  expect(sdk.uploadBytes).not.toHaveBeenCalled()
  expect(sdk.updateDoc).not.toHaveBeenCalled()
})

test('a deleted refuel lets the invoice go', async () => {
  sdk.refuel = null

  await expect(uploadInvoice(invoice)).resolves.toBe('discarded')
  expect(sdk.uploadBytes).not.toHaveBeenCalled()
})
