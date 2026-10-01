import { db } from 'services/db'
import { useTanksStore } from 'store/tanks'

beforeEach(async () => {
  await db.tanks.clear()
  useTanksStore.setState({ tanks: [], status: 'idle' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('load seeds the predefined tanks once, even when called twice', async () => {
  const { load } = useTanksStore.getState()

  await Promise.all([load(), load()])

  expect(useTanksStore.getState().status).toBe('ready')
  expect(useTanksStore.getState().tanks).toHaveLength(15)
  expect(await db.tanks.count()).toBe(15)
})

test('a failed load is reported and leaves the error state', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(db.tanks, 'toArray').mockRejectedValueOnce(new Error('Blocked'))

  await useTanksStore.getState().load()

  expect(useTanksStore.getState().status).toBe('error')
  expect(consoleError).toHaveBeenCalledWith(
    '[loadTanks]',
    expect.objectContaining({ operation: 'loadTanks' }),
    expect.any(Error)
  )
})

test('addTank keeps the list sorted by size', async () => {
  await useTanksStore.getState().load()

  const tank = await useTanksStore
    .getState()
    .addTank({ capacity: 60, diameter: 20, length: 40 })

  const { tanks } = useTanksStore.getState()
  expect(tanks).toHaveLength(16)
  expect(tanks[1]).toEqual(tank)
})
