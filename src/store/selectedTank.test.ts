import { sileo } from 'sileo'
import { useSelectedTankStore } from 'store/selectedTank'
import { cylinder } from '../testing/localTank'

const tank = cylinder({ id: 3, capacity: 75, diameter: 24, length: 41 })

beforeEach(() => {
  window.localStorage.clear()
  useSelectedTankStore.getState().rehydrate()
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('selecting a tank persists it under the legacy key', () => {
  useSelectedTankStore.getState().selectTank(tank)

  expect(useSelectedTankStore.getState().selectedTank).toEqual(tank)
  expect(JSON.parse(window.localStorage.getItem('defaultTank') ?? '')).toEqual(
    tank
  )
})

test('reads selections stored by older builds', () => {
  window.localStorage.setItem(
    'defaultTank',
    JSON.stringify({ id: 3, capacity: '75', diameter: '24', length: '41' })
  )

  useSelectedTankStore.getState().rehydrate()

  expect(useSelectedTankStore.getState().selectedTank).toEqual(tank)
})

test('treats the legacy empty selection as no tank', () => {
  window.localStorage.setItem('defaultTank', '{}')

  useSelectedTankStore.getState().rehydrate()

  expect(useSelectedTankStore.getState().selectedTank).toBeNull()
})

test('keeps the selection for the session when it cannot be saved', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError')
  })

  useSelectedTankStore.getState().selectTank(tank)

  expect(useSelectedTankStore.getState().selectedTank).toEqual(tank)
  expect(sileo.error).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'No pudimos recordar tu elección' })
  )
})
