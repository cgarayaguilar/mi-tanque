// readAccount settles the unit of an organization from before specs/0010
// before the session is ready (audit 2026-10-02)
import { readAccount } from 'services/session'

interface Snapshot {
  id: string
  exists: () => boolean
  data: () => Record<string, unknown>
  get: (field: string) => unknown
}

const snapshot = (
  id: string,
  data: Record<string, unknown> | null
): Snapshot => ({
  id,
  exists: () => data !== null,
  data: () => data ?? {},
  get: field => data?.[field],
})

const store = vi.hoisted(() => {
  const docs: Record<string, Record<string, unknown> | null> = {}
  const collections: Record<string, Record<string, unknown>[]> = {}
  return { docs, collections, callable: vi.fn() }
})

vi.mock('firebase/firestore', async importOriginal => ({
  ...(await importOriginal<object>()),
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  collection: (_db: unknown, name: string) => name,
  query: (name: string) => name,
  where: () => null,
  limit: () => null,
  getDoc: (path: string) =>
    Promise.resolve(
      snapshot(path.split('/')[1] ?? '', store.docs[path] ?? null)
    ),
  getDocs: (name: string) =>
    Promise.resolve({
      docs: (store.collections[name] ?? []).map((data, index) =>
        snapshot(String(index), data)
      ),
    }),
}))
vi.mock('firebase/functions', () => ({
  httpsCallable: () => store.callable,
}))
vi.mock('services/firebase', () => ({
  loadFirebase: () => Promise.resolve({ db: 'db', functions: 'functions' }),
}))

beforeEach(() => {
  store.docs = {
    'users/ana': { displayName: 'Ana', activeOrgId: 'org-a' },
    'organizations/org-a': { name: 'Flota', defaultCurrency: 'NIO' },
  }
  store.collections = {
    members: [
      { orgId: 'org-a', role: 'owner', orgName: 'Flota', phoneNumber: null },
    ],
    trucks: [
      { distanceUnit: 'mi' },
      { distanceUnit: 'mi' },
      { distanceUnit: 'km' },
    ],
  }
  store.callable.mockReset()
})

test('an organization without a unit gets the one the server settles', async () => {
  store.callable.mockResolvedValue({ data: { distanceUnit: 'mi' } })

  const account = await readAccount('ana')

  expect(store.callable).toHaveBeenCalledWith({
    action: 'settleDistanceUnit',
    orgId: 'org-a',
  })
  expect(account.organization?.distanceUnit).toBe('mi')
})

test('without a connection, the unit most of its trucks have', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  store.callable.mockRejectedValue(new Error('unavailable'))

  const account = await readAccount('ana')

  expect(account.organization?.distanceUnit).toBe('mi')
})

test('a saved unit is not settled again', async () => {
  store.docs['organizations/org-a'] = {
    name: 'Flota',
    defaultCurrency: 'NIO',
    distanceUnit: 'km',
  }

  const account = await readAccount('ana')

  expect(store.callable).not.toHaveBeenCalled()
  expect(account.organization?.distanceUnit).toBe('km')
})
