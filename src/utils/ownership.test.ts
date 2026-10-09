import { ownershipLine, thirdParty, tripOwnership } from 'utils/ownership'
import { trailer, trip, truck } from '../testing/fleetFixtures'

// backend specs/0035 RF-4
test("a third party's line, with its owner if known", () => {
  expect(ownershipLine(truck())).toBeNull()
  expect(
    ownershipLine(truck({ ownership: 'third_party', ownerName: 'López' }))
  ).toBe('De un tercero · López')
  expect(ownershipLine(truck({ ownership: 'third_party' }))).toBe(
    'De un tercero'
  )
  expect(thirdParty('Unidad 30', 'third_party')).toBe(
    'Unidad 30 (de un tercero)'
  )
  expect(thirdParty('Unidad 30', 'own')).toBe('Unidad 30')
})

// RF-2: as the trip saved it; from before, as the equipment is now
test("a trip's equipment, saved or as it is now", () => {
  const fleet = {
    trucks: [truck({ ownership: 'third_party' })],
    trailers: [trailer()],
  }
  expect(
    tripOwnership(
      trip({ truckOwnership: 'own', trailerOwnership: 'own' }),
      fleet
    )
  ).toEqual({ truck: 'own', trailer: 'own' })
  expect(
    tripOwnership(trip({ truckOwnership: null, trailerOwnership: null }), fleet)
  ).toEqual({ truck: 'third_party', trailer: 'own' })
  expect(
    tripOwnership(
      trip({ trailerId: null, trailerName: null, trailerOwnership: null }),
      fleet
    )
  ).toEqual({ truck: 'own', trailer: null })
})
