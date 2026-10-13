import { trip } from '../testing/fleetFixtures'
import { tripInProgress, tripsForEquipment } from 'utils/tripOfEquipment'

// backend specs/0042 RF-2, RNF-3: the same rule as the backend's activeTrip
const truck = { kind: 'truck', id: 'truck-1' } as const
const at = new Date(2026, 9, 8, 12)

const trips = [
  trip({ id: 'old', status: 'in_progress', startAt: new Date(2026, 9, 5) }),
  trip({ id: 'last', status: 'in_progress', startAt: new Date(2026, 9, 7) }),
  trip({ id: 'later', status: 'in_progress', startAt: new Date(2026, 9, 9) }),
  trip({ id: 'done', status: 'done', startAt: new Date(2026, 9, 8) }),
  trip({
    id: 'other',
    status: 'in_progress',
    truckId: 'truck-2',
    trailerId: null,
    startAt: new Date(2026, 9, 7),
  }),
]

test('the trip in progress of the truck then: the one started last', () => {
  expect(tripInProgress(trips, truck, at)?.id).toBe('last')
  expect(
    tripInProgress(trips, { kind: 'trailer', id: 'trailer-1' }, at)?.id
  ).toBe('last')
})

test('none ended before, none without equipment', () => {
  expect(
    tripInProgress(
      [trip({ status: 'in_progress', endAt: new Date(2026, 9, 7) })],
      truck,
      at
    )
  ).toBeNull()
  expect(tripInProgress(trips, { kind: 'none', id: null }, at)).toBeNull()
})

test("the trips offered carry the tank's equipment; without one, all", () => {
  expect(tripsForEquipment(trips, truck).map(item => item.id)).toEqual([
    'old',
    'last',
    'later',
    'done',
  ])
  expect(tripsForEquipment(trips, { kind: 'none', id: null })).toHaveLength(5)
})
