import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import { ORG_ID, tank, trailer, truck } from '../testing/fleetFixtures'

const api = vi.hoisted(() => ({
  readFleet: vi.fn(),
  readMembers: vi.fn(() => Promise.resolve([])),
  updateFleetItem: vi.fn(() => Promise.resolve()),
}))
vi.mock('services/fleet', () => api)

beforeEach(() => {
  useFleetStore.getState().reset()
  api.readFleet.mockResolvedValue({
    drivers: [],
    clients: [],
    trucks: [
      truck({ id: 'b', name: 'Unidad 2' }),
      truck({ id: 'a', name: 'Unidad 10' }),
    ],
    trailers: [trailer()],
    tanks: [tank()],
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('loads the fleet of the organization, sorted by name with numbers', async () => {
  await useFleetStore.getState().load(ORG_ID)

  const state = useFleetStore.getState()
  expect(state.status).toBe('ready')
  expect(state.trucks.map(t => t.name)).toEqual(['Unidad 2', 'Unidad 10'])
  expect(api.readFleet).toHaveBeenCalledWith(ORG_ID)
})

test('a failed read shows the error state', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  api.readFleet.mockRejectedValueOnce(new Error('unavailable'))

  await useFleetStore.getState().load(ORG_ID)

  expect(useFleetStore.getState().status).toBe('error')
})

test('a save shows at once, before the server answers (offline, ADR 0003)', async () => {
  await useFleetStore.getState().load(ORG_ID)
  let finishWrite: (() => void) | undefined
  const write = () =>
    new Promise<void>(resolve => {
      finishWrite = resolve
    })

  const pending = useFleetStore
    .getState()
    .save('trucks', truck({ id: 'c', name: 'Unidad 3' }), write)

  expect(useFleetStore.getState().trucks.map(t => t.name)).toEqual([
    'Unidad 2',
    'Unidad 3',
    'Unidad 10',
  ])
  finishWrite?.()
  await pending
})

test('archiving hides it from the active list at once and writes the flag', async () => {
  await useFleetStore.getState().load(ORG_ID)

  await useFleetStore.getState().setArchived('trucks', 'a', true)

  expect(
    useFleetStore.getState().trucks.find(t => t.id === 'a')?.archived
  ).toBe(true)
  expect(api.updateFleetItem).toHaveBeenCalledWith('trucks', 'a', {
    archived: true,
  })
})

test('switching organization clears the previous fleet', async () => {
  await useFleetStore.getState().load(ORG_ID)

  useSessionStore.setState({
    organization: { id: 'other', name: 'Otra', defaultCurrency: 'USD' },
  })

  expect(useFleetStore.getState()).toMatchObject({ trucks: [], status: 'idle' })
})

// Regression: the trigger updates the tank later, so a refuel right after a
// measurement took the previous level as "before"
test('a reading saved here is the tank last reading at once, unless older', async () => {
  await useFleetStore.getState().load(ORG_ID)
  const id = useFleetStore.getState().tanks[0]?.id ?? ''
  const reading = {
    id: 'm-new',
    takenAt: new Date(2030, 0, 1),
    gallons: 42,
    fillPercent: 56,
  }

  useFleetStore.getState().setLastReading(id, reading)
  useFleetStore.getState().setLastReading(id, {
    ...reading,
    id: 'm-old',
    takenAt: new Date(2020, 0, 1),
  })

  expect(useFleetStore.getState().tanks[0]?.lastMeasurement).toEqual(reading)
})
