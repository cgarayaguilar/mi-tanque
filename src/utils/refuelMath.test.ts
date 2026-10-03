import {
  gallonsAt,
  fullVolumeGallons,
  type TankGeometry,
} from 'utils/tankVolume'
import {
  levelAt,
  refuelAmounts,
  refuelLevels,
  refuelSummary,
  truckEfficiency,
  truckTotals,
} from 'utils/refuelMath'

const D_TANK: TankGeometry = {
  shape: 'd_flat_side',
  orientation: 'horizontal',
  dimensions: { heightIn: 24, widthIn: 30, lengthIn: 48 },
}

test('50 L at C$ 30 per liter: 13,21 gal, C$ 113,56 per gallon, C$ 1 500 (CA-1)', () => {
  expect(
    refuelAmounts({
      quantity: 50,
      quantityUnit: 'liter',
      price: 30,
      priceUnit: 'liter',
    })
  ).toEqual({
    gallonsAdded: 13.21,
    litersAdded: 50,
    pricePerGallon: 113.56,
    pricePerLiter: 30,
    total: 1500,
  })
})

test('gallons at a price per gallon convert the other way', () => {
  expect(
    refuelAmounts({
      quantity: 20,
      quantityUnit: 'gallon',
      price: 4,
      priceUnit: 'gallon',
    })
  ).toEqual({
    gallonsAdded: 20,
    litersAdded: 75.71,
    pricePerGallon: 4,
    pricePerLiter: 1.06,
    total: 80,
  })
})

test('levels come from the inches when written (RF-3)', () => {
  const levels = refuelLevels({
    geometry: D_TANK,
    gallonsAdded: 50,
    inchesBefore: 6,
    inchesAfter: 20,
    lastGallons: 99,
  })
  expect(levels.gallonsBefore).toBe(
    Math.round(gallonsAt(D_TANK, 6) * 100) / 100
  )
  expect(levels.gallonsAfter).toBe(
    Math.round(gallonsAt(D_TANK, 20) * 100) / 100
  )
  expect(levels.fillPercentAfter).toBeGreaterThan(
    levels.fillPercentBefore ?? 100
  )
})

test('without inches: the latest reading plus what was added, capped at the volume (RF-3)', () => {
  const full = fullVolumeGallons(D_TANK)
  expect(
    refuelLevels({
      geometry: D_TANK,
      gallonsAdded: 30,
      inchesBefore: null,
      inchesAfter: null,
      lastGallons: 40,
    })
  ).toMatchObject({ gallonsBefore: 40, gallonsAfter: 70 })
  expect(
    refuelLevels({
      geometry: D_TANK,
      gallonsAdded: 500,
      inchesBefore: null,
      inchesAfter: null,
      lastGallons: 40,
    })
  ).toMatchObject({
    gallonsAfter: Math.round(full * 100) / 100,
    fillPercentAfter: 100,
  })
})

test('without inches nor a previous reading, the levels are unknown', () => {
  expect(
    refuelLevels({
      geometry: D_TANK,
      gallonsAdded: 30,
      inchesBefore: null,
      inchesAfter: null,
      lastGallons: null,
    })
  ).toEqual({
    gallonsBefore: null,
    gallonsAfter: null,
    fillPercentBefore: null,
    fillPercentAfter: null,
  })
})

test('truck totals add the other tanks, unknown if any is (RF-9)', () => {
  expect(truckTotals({ gallonsBefore: 20, gallonsAfter: 100 }, [55.5])).toEqual(
    {
      truckGallonsBefore: 75.5,
      truckGallonsAfter: 155.5,
    }
  )
  expect(
    truckTotals({ gallonsBefore: 20, gallonsAfter: 100 }, [55, null])
  ).toEqual({
    truckGallonsBefore: null,
    truckGallonsAfter: null,
  })
})

test('real efficiency by levels, checked by hand (CA-4)', () => {
  const at = (day: number) => new Date(2026, 8, day)
  // 1: fills to 180 gal at 100 000 km
  // 2: no odometer, adds 20 gal in between
  // 3: at 101 000 km had 60 gal before → used 180 − 60 + 20 = 140 gal
  // 4: at 101 700 km had 100 before, after 3 left it at 170 → used 70 gal
  // Total: 1 700 km / 210 gal = 8,10 km/gal
  expect(
    truckEfficiency([
      {
        takenAt: at(4),
        odometerKm: 101700,
        gallonsAdded: 60,
        truckGallonsBefore: 100,
        truckGallonsAfter: 160,
      },
      {
        takenAt: at(1),
        odometerKm: 100000,
        gallonsAdded: 150,
        truckGallonsBefore: 30,
        truckGallonsAfter: 180,
      },
      {
        takenAt: at(2),
        odometerKm: null,
        gallonsAdded: 20,
        truckGallonsBefore: null,
        truckGallonsAfter: null,
      },
      {
        takenAt: at(3),
        odometerKm: 101000,
        gallonsAdded: 110,
        truckGallonsBefore: 60,
        truckGallonsAfter: 170,
      },
    ])
  ).toEqual({ km: 1700, gallons: 210, kmPerGal: 8.1 })
})

test('stretches without distance or fuel used are skipped; one refuel is not enough', () => {
  const at = (day: number) => new Date(2026, 8, day)
  expect(
    truckEfficiency([
      {
        takenAt: at(1),
        odometerKm: 100,
        gallonsAdded: 10,
        truckGallonsBefore: 10,
        truckGallonsAfter: 20,
      },
    ])
  ).toBeNull()
  expect(
    truckEfficiency([
      {
        takenAt: at(1),
        odometerKm: 100,
        gallonsAdded: 10,
        truckGallonsBefore: 10,
        truckGallonsAfter: 20,
      },
      {
        takenAt: at(2),
        odometerKm: 100,
        gallonsAdded: 10,
        truckGallonsBefore: 15,
        truckGallonsAfter: 25,
      },
    ])
  ).toBeNull()
})

test('the summary adds fuel overall and money per currency, never converted (RF-8)', () => {
  expect(
    refuelSummary([
      { currency: 'NIO', total: 1500, gallonsAdded: 13.21, litersAdded: 50 },
      { currency: 'USD', total: 80, gallonsAdded: 20, litersAdded: 75.71 },
      { currency: 'NIO', total: 3000, gallonsAdded: 26.42, litersAdded: 100 },
    ])
  ).toEqual({
    gallons: 59.63,
    liters: 225.71,
    byCurrency: [
      {
        currency: 'NIO',
        total: 4500,
        gallons: 39.63,
        liters: 150,
        perGallon: 113.55,
        perLiter: 30,
      },
      {
        currency: 'USD',
        total: 80,
        gallons: 20,
        liters: 75.71,
        perGallon: 4,
        perLiter: 1.06,
      },
    ],
  })
})

// specs/0015 RF-9: refuel levels of a catalog tank use the same adjustment
test('levels of a catalog tank are scaled; its % is not', () => {
  const geometry = {
    shape: 'cylinder' as const,
    orientation: 'horizontal' as const,
    dimensions: { diameterIn: 24.5, lengthIn: 50 },
  }
  const plain = levelAt(geometry, 12)
  const scaled = levelAt(geometry, 12, 0.98)
  expect(scaled.gallons).toBeCloseTo(plain.gallons * 0.98, 1)
  expect(scaled.percent).toBe(plain.percent)
  const levels = refuelLevels({
    geometry,
    gallonsAdded: 500,
    inchesBefore: null,
    inchesAfter: null,
    lastGallons: 10,
    scale: 0.98,
  })
  // Capped at the adjusted full tank
  expect(levels.gallonsAfter).toBeCloseTo(fullVolumeGallons(geometry) * 0.98, 1)
})
