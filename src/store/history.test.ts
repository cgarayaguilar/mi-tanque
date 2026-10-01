import { db } from 'services/db'
import { defaultPeriod, useHistoryStore } from 'store/history'

const reset = () => {
  useHistoryStore.setState({
    chosenPeriod: null,
    status: 'idle',
    histories: [],
  })
}

beforeEach(async () => {
  await db.measurements.clear()
  await db.tanks.clear()
  reset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('the default period is the last week through the end of today', () => {
  const period = defaultPeriod(new Date(2026, 8, 30, 9, 15))

  expect(period).toEqual({
    start: new Date(2026, 8, 23),
    end: new Date(2026, 8, 30, 23, 59, 59, 999),
  })
})

test('choosing a period covers whole days', async () => {
  await useHistoryStore.getState().choosePeriod({
    start: new Date(2026, 8, 1, 15),
    end: new Date(2026, 8, 2, 8),
  })

  expect(useHistoryStore.getState().chosenPeriod).toEqual({
    start: new Date(2026, 8, 1),
    end: new Date(2026, 8, 2, 23, 59, 59, 999),
  })
  expect(useHistoryStore.getState().status).toBe('ready')
})

test('a slower, older request does not overwrite the latest period', async () => {
  const tankId = await db.tanks.add({ capacity: 75, diameter: 24, length: 41 })
  await db.measurements.add({
    date: new Date(2026, 8, 1, 12),
    inches: 10,
    gallons: '40.00',
    liters: '151.40',
    fuelHeight: '41.67',
    location: 'Sin ubicación',
    tankId,
  })
  const { choosePeriod } = useHistoryStore.getState()

  const older = choosePeriod({
    start: new Date(2026, 8, 1),
    end: new Date(2026, 8, 1),
  })
  const latest = choosePeriod({
    start: new Date(2026, 7, 1),
    end: new Date(2026, 7, 2),
  })
  await Promise.all([older, latest])

  expect(useHistoryStore.getState().histories).toEqual([])
  expect(useHistoryStore.getState().chosenPeriod?.start).toEqual(
    new Date(2026, 7, 1)
  )
})

test('a failed load is reported and leaves the error state', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(db.measurements, 'where').mockImplementationOnce(() => {
    throw new Error('Blocked')
  })

  await useHistoryStore.getState().load()

  expect(useHistoryStore.getState().status).toBe('error')
  expect(consoleError).toHaveBeenCalledWith(
    '[loadHistory]',
    expect.objectContaining({ operation: 'loadHistory' }),
    expect.any(Error)
  )
})
