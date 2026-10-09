import { useExpensesStore } from 'store/expenses'
import { useSessionStore } from 'store/session'
import type { Role } from 'utils/roles'
import {
  accountWithRole,
  expense,
  ORG_ID,
  presetCategories,
} from '../testing/fleetFixtures'

const api = vi.hoisted(() => ({
  readCategories: vi.fn(),
  seedCategories: vi.fn(),
  readExpensesInPeriod: vi.fn(),
}))
vi.mock('services/expenses', () => api)

const signIn = (role: Role) => {
  useSessionStore.setState({
    status: 'ready',
    user: { uid: 'luis', displayName: 'Luis', email: null, phoneNumber: null },
    ...accountWithRole(role),
  })
}

beforeEach(() => {
  signIn('owner')
  useExpensesStore.getState().reset()
  api.readCategories.mockResolvedValue([])
  api.seedCategories.mockResolvedValue(presetCategories())
})

afterEach(() => {
  vi.clearAllMocks()
})

// backend specs/0026 RF-1. Regression: two loads at once (React runs effects
// twice in development) both found none and seeded twice; the second batch
// was an update the rules rejected (PERMISSION_DENIED in the console)
test('two loads at once read and seed once', async () => {
  const { loadCategories } = useExpensesStore.getState()
  await Promise.all([loadCategories(ORG_ID), loadCategories(ORG_ID)])

  expect(api.readCategories).toHaveBeenCalledTimes(1)
  expect(api.seedCategories).toHaveBeenCalledTimes(1)
  const state = useExpensesStore.getState()
  expect(state.categoriesStatus).toBe('ready')
  expect(state.categories[0]?.name).toBe('Combustible')

  // Once done, a new load reads again
  await loadCategories(ORG_ID)
  expect(api.readCategories).toHaveBeenCalledTimes(2)
})

test('a viewer sees the presets without writing them', async () => {
  signIn('viewer')
  await useExpensesStore.getState().loadCategories(ORG_ID)

  expect(api.seedCategories).not.toHaveBeenCalled()
  expect(useExpensesStore.getState().categories).toHaveLength(9)
})

test('categories already there are not seeded', async () => {
  api.readCategories.mockResolvedValue(presetCategories())
  await useExpensesStore.getState().loadCategories(ORG_ID)

  expect(api.seedCategories).not.toHaveBeenCalled()
})

// RF-12: a trip's expenses, saved with it, show at once
test("a trip's saved and removed expenses update the period and what is known", async () => {
  api.readExpensesInPeriod.mockResolvedValue({
    items: [expense({ id: 'a' }), expense({ id: 'b' })],
    truncated: false,
  })
  await useExpensesStore.getState().load(ORG_ID)

  useExpensesStore
    .getState()
    .applyTripExpenses([expense({ id: 'c', takenAt: new Date() })], ['a'])

  const state = useExpensesStore.getState()
  expect(state.items.map(item => item.id).sort()).toEqual(['b', 'c'])
  expect(Object.keys(state.known).sort()).toEqual(['b', 'c'])
})

// Audit 0027: offline with nothing cached, nothing is seeded
test('offline the first time: an error to retry, not a seed', async () => {
  api.readCategories.mockRejectedValue(new Error('expense-categories-not-read'))
  await useExpensesStore.getState().loadCategories(ORG_ID)

  expect(api.seedCategories).not.toHaveBeenCalled()
  expect(useExpensesStore.getState().categoriesStatus).toBe('error')
})

// Audit 0027: a trip's expense moved or deleted elsewhere leaves it here too
test("a trip's expenses as read replace the ones known of that trip", async () => {
  api.readExpensesInPeriod.mockResolvedValue({
    items: [expense({ id: 'a' }), expense({ id: 'b' })],
    truncated: false,
  })
  await useExpensesStore.getState().load(ORG_ID)

  useExpensesStore
    .getState()
    .replaceTripExpenses('trip-1', [expense({ id: 'b', amount: 99 })])

  const state = useExpensesStore.getState()
  expect(Object.keys(state.known)).toEqual(['b'])
  expect(state.known.b?.amount).toBe(99)
  expect(state.items.map(item => item.id)).toEqual(['b'])
})

// Audit 2026-10-09: a refused save left an expense that was never saved
test('a refused save puts back what there was', async () => {
  const saved = expense({ takenAt: new Date() })
  useExpensesStore.getState().remember([saved])
  const changed = { ...saved, amount: 9 }
  await expect(
    useExpensesStore
      .getState()
      .save(changed, () => Promise.reject(new Error('denied')))
  ).rejects.toThrow('denied')
  expect(useExpensesStore.getState().known[saved.id]).toBe(saved)

  const fresh = expense({ id: 'fresh', takenAt: new Date() })
  await expect(
    useExpensesStore
      .getState()
      .save(fresh, () => Promise.reject(new Error('denied')))
  ).rejects.toThrow('denied')
  expect(useExpensesStore.getState().known.fresh).toBeUndefined()
  expect(useExpensesStore.getState().items).toEqual([])
})
