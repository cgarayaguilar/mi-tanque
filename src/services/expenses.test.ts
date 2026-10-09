import { expenseChanges } from 'services/expenses'
import { expense } from '../testing/fleetFixtures'

vi.mock('services/firebase', () => ({
  loadFirebase: vi.fn(),
  loadStorage: vi.fn(),
}))

// Audit 2026-10-09: an edit read before the photo was added cleared it
test('an edit leaves the receipt as it is', () => {
  const {
    id: _,
    orgId: __,
    refuelId: ___,
    createdAt: ____,
    createdBy: _____,
    ...fields
  } = expense({ receiptPhotoPath: null, description: 'Peaje' })
  const changes = expenseChanges('luis', fields)
  expect(changes).not.toHaveProperty('receiptPhotoPath')
  expect(changes).toMatchObject({ description: 'Peaje', updatedBy: 'luis' })
})
