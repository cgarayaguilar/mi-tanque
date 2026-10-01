import { periodOf, useCloudHistoryStore } from 'store/cloudHistory'
import { useSessionStore } from 'store/session'
import {
  accountWithRole,
  cloudMeasurement,
  ORG_ID,
} from '../testing/fleetFixtures'

const api = vi.hoisted(() => ({
  readHistoryPage: vi.fn(),
}))
vi.mock('services/cloudMeasurements', () => api)

const page = (...ids: string[]) => ({
  items: ids.map(id => cloudMeasurement({ id })),
  cursor: null,
})

beforeEach(() => {
  useCloudHistoryStore.getState().reset()
  api.readHistoryPage.mockResolvedValue(page('a', 'b'))
})

afterEach(() => {
  vi.clearAllMocks()
})

test('loads the last week of the organization by default (RF-10, RF-11)', async () => {
  await useCloudHistoryStore.getState().load(ORG_ID)

  const { start, end } = periodOf(useCloudHistoryStore.getState())
  expect(api.readHistoryPage).toHaveBeenCalledWith({
    orgId: ORG_ID,
    start,
    end,
    equipmentId: null,
    after: null,
  })
  expect(start.getHours()).toBe(0)
  expect(useCloudHistoryStore.getState()).toMatchObject({
    status: 'ready',
    items: [{ id: 'a' }, { id: 'b' }],
  })
})

test('a choice of period is stretched to whole days and reloads', async () => {
  await useCloudHistoryStore.getState().load(ORG_ID)
  await useCloudHistoryStore.getState().choosePeriod({
    start: new Date(2026, 8, 1, 15, 30),
    end: new Date(2026, 8, 3, 9, 0),
  })
  expect(api.readHistoryPage).toHaveBeenLastCalledWith(
    expect.objectContaining({
      start: new Date(2026, 8, 1, 0, 0, 0, 0),
      end: new Date(2026, 8, 3, 23, 59, 59, 999),
    })
  )
})

test('only the latest request writes: a slow page of the previous filter is dropped', async () => {
  let finishSlow: (value: unknown) => void = () => undefined
  api.readHistoryPage.mockReturnValueOnce(
    new Promise(resolve => {
      finishSlow = resolve
    })
  )
  const slow = useCloudHistoryStore.getState().load(ORG_ID)
  // In Vitest, two import() calls started in the same tick can resolve the
  // second to the real module: wait until the slow read is in flight
  await vi.waitFor(() => {
    expect(api.readHistoryPage).toHaveBeenCalledTimes(1)
  })
  await useCloudHistoryStore.getState().chooseEquipment('truck-1')
  finishSlow(page('old'))
  await slow

  expect(useCloudHistoryStore.getState().items.map(item => item.id)).toEqual([
    'a',
    'b',
  ])
  expect(useCloudHistoryStore.getState().equipmentId).toBe('truck-1')
})

test('an edit and a removal show at once', async () => {
  await useCloudHistoryStore.getState().load(ORG_ID)
  useCloudHistoryStore.getState().applyEdit('a', {
    tankId: 'tank-2',
    tankName: 'Otro',
    equipment: { kind: 'none', id: null, name: null },
    reading: {
      inches: 5,
      gallons: 10,
      liters: 37.85,
      fillPercent: 20,
      estimate: null,
    },
    odometerKm: null,
  })
  useCloudHistoryStore.getState().remove('b')

  expect(useCloudHistoryStore.getState().items).toEqual([
    expect.objectContaining({
      id: 'a',
      tankId: 'tank-2',
      tankName: 'Otro',
      gallons: 10,
      estimate: null,
    }),
  ])
})

test('switching organization leaves nothing of the previous history', async () => {
  useSessionStore.setState({ status: 'ready', ...accountWithRole('owner') })
  await useCloudHistoryStore.getState().load(ORG_ID)

  useSessionStore.setState({
    organization: { id: 'org-b', name: 'Otra', defaultCurrency: 'USD' },
  })
  expect(useCloudHistoryStore.getState()).toMatchObject({
    orgId: null,
    items: [],
    status: 'idle',
  })
})

test('a failed load is reported as an error state', async () => {
  api.readHistoryPage.mockRejectedValueOnce(new Error('unavailable'))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await useCloudHistoryStore.getState().load(ORG_ID)
  expect(useCloudHistoryStore.getState().status).toBe('error')
})
