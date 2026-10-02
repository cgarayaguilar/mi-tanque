import type { LocalRefuel, Measurement, Tank } from 'types'
import {
  importId,
  importIdsFor,
  planImport,
  tankFingerprint,
  type ImportScope,
} from 'utils/importPlan'
import { calcFuelLevel } from 'utils/calcFuelLevel'

const NOW = new Date(2026, 9, 1, 12, 0)

const scope = (uid: string, orgId = 'org-1'): ImportScope => ({
  orgId,
  uid,
  deviceId: 'dev1',
})
const NOTHING_YET = {
  tanks: new Map<string, string>(),
  measurements: new Map<string, number>(),
  refuels: new Map<string, number>(),
}
const idsFor = (uid: string, orgId = 'org-1') =>
  importIdsFor(scope(uid, orgId), NOTHING_YET)

const localTank = (overrides: Partial<Tank> = {}): Tank => ({
  id: 3,
  capacity: 75,
  diameter: 25,
  length: 39,
  ...overrides,
})

const local = (overrides: Partial<Measurement> = {}): Measurement => ({
  id: 10,
  tankId: 3,
  date: new Date(2026, 5, 2, 8, 30),
  inches: 12,
  gallons: '38.85',
  liters: '147.06',
  fuelHeight: '48.00',
  location: 'Managua, Nicaragua',
  ...overrides,
})

test('a used tank becomes an imported individual cylinder, linked to its template (RF-16)', () => {
  const plan = planImport(
    idsFor('uid-1'),
    [localTank(), localTank({ id: 4 })],
    [local()],
    NOW
  )

  // Tank 4 has no measurements: it is not brought
  expect(plan.tanks).toEqual([
    {
      id: 'import-org-1-uid-1-dev1-3',
      name: 'Tanque de 75 gal (importado)',
      capacityGal: 75,
      diameterIn: 25,
      lengthIn: 39,
      templateId: 'cyl-75-25x39',
    },
  ])
})

test('measurements keep their date, amounts and place, with the percent by volume (RF-16)', () => {
  const plan = planImport(idsFor('uid-1'), [localTank()], [local()], NOW)
  const full = calcFuelLevel({
    tankDiameter: 25,
    tankLength: 39,
    fuelHeight: 25,
  })

  expect(plan.measurements).toEqual([
    {
      id: 'import-org-1-uid-1-dev1-10',
      tankId: 'import-org-1-uid-1-dev1-3',
      tankName: 'Tanque de 75 gal (importado)',
      takenAt: new Date(2026, 5, 2, 8, 30),
      inches: 12,
      gallons: 38.85,
      liters: 147.06,
      fillPercent: Math.round((38.85 / full) * 10000) / 100,
      legacyPlace: 'Managua, Nicaragua',
    },
  ])
  expect(plan.skipped).toBe(0)
})

test('ids are deterministic, so importing again plans the same documents (RF-17)', () => {
  const first = planImport(idsFor('uid-1'), [localTank()], [local()], NOW)
  const second = planImport(idsFor('uid-1'), [localTank()], [local()], NOW)
  expect(second).toEqual(first)
  expect(importId(scope('uid-1'), 10)).toBe('import-org-1-uid-1-dev1-10')
})

test('"Sin ubicación" and blanks become no place; long places are cut to 120', () => {
  const plan = planImport(
    idsFor('u'),
    [localTank()],
    [
      local({ id: 1, location: 'Sin ubicación' }),
      local({ id: 2, location: '  ' }),
      local({ id: 3, location: 'x'.repeat(200) }),
    ],
    NOW
  )
  expect(plan.measurements.map(m => m.legacyPlace?.length ?? null)).toEqual([
    null,
    null,
    120,
  ])
})

test('what the rules would reject is skipped and counted, not sent', () => {
  const plan = planImport(
    idsFor('u'),
    [localTank(), localTank({ id: 9, diameter: 300 })],
    [
      local({ id: 1, inches: 0 }),
      local({ id: 2, inches: 26 }),
      local({ id: 3, gallons: '200' }),
      local({ id: 4, date: new Date(2019, 11, 31) }),
      local({ id: 5, date: new Date(2026, 9, 1, 12, 10) }),
      local({ id: 6, tankId: 9 }),
      local({ id: 7, tankId: 99 }),
      local({ id: 8 }),
    ],
    NOW
  )
  expect(plan.measurements.map(m => m.id)).toEqual(['import-org-1-u-dev1-8'])
  expect(plan.skipped).toBe(7)
  expect(plan.tanks.map(t => t.id)).toEqual(['import-org-1-u-dev1-3'])
})

test('a tank that is not a template keeps no template', () => {
  const plan = planImport(
    idsFor('u'),
    [localTank({ capacity: 80 })],
    [local()],
    NOW
  )
  expect(plan.tanks[0]?.templateId).toBeNull()
})

const localRefuel = (overrides: Partial<LocalRefuel> = {}): LocalRefuel => ({
  id: 7,
  intentId: 'i',
  date: new Date(2026, 5, 3, 9, 0),
  tankId: 3,
  gallonsAdded: 13.21,
  litersAdded: 50,
  quantityUnit: 'liter',
  currency: 'NIO',
  priceUnit: 'liter',
  pricePerGallon: 113.56,
  pricePerLiter: 30,
  total: 1500,
  inchesBefore: null,
  inchesAfter: null,
  gallonsBefore: 20,
  gallonsAfter: 33.21,
  fillPercentBefore: 25,
  fillPercentAfter: 41,
  stationName: 'Puma Km 7',
  ...overrides,
})

test('refuels go to the same imported tank, with their own ids (specs/0006 RF-14)', () => {
  const plan = planImport(idsFor('u'), [localTank()], [], NOW, [
    localRefuel(),
    localRefuel({ id: 8, currency: 'EUR' as never }),
    localRefuel({ id: 9, gallonsAdded: 0 }),
  ])
  expect(plan.tanks.map(t => t.id)).toEqual(['import-org-1-u-dev1-3'])
  expect(plan.refuels).toEqual([
    expect.objectContaining({
      id: 'import-org-1-u-dev1-r7',
      tankId: 'import-org-1-u-dev1-3',
      tankName: 'Tanque de 75 gal (importado)',
      takenAt: new Date(2026, 5, 3, 9, 0),
      total: 1500,
      stationName: 'Puma Km 7',
    }),
  ])
  expect(plan.refuels[0]).not.toHaveProperty('intentId')
  expect(plan.skipped).toBe(2)
})

// Regression: ids without the organization made a second organization hit
// the first one's documents, and the rules rejected the whole import
test('each organization gets its own documents', () => {
  const first = planImport(idsFor('u', 'org-a'), [localTank()], [local()], NOW)
  const second = planImport(idsFor('u', 'org-b'), [localTank()], [local()], NOW)
  expect(first.tanks[0]?.id).not.toBe(second.tanks[0]?.id)
  expect(first.measurements[0]?.id).not.toBe(second.measurements[0]?.id)
})

// Records imported before the amendment keep their id, so importing again
// does not duplicate them; another phone's record with the same local id is
// not taken for them (regression: it was skipped as "already imported")
describe('imports made with the old ids', () => {
  const takenAt = new Date(2026, 5, 2, 8, 30)
  const legacy = (measurementTakenAt: number) =>
    importIdsFor(scope('u'), {
      tanks: new Map([
        [
          'import-u-3',
          tankFingerprint({ capacityGal: 75, diameterIn: 25, lengthIn: 39 }),
        ],
      ]),
      measurements: new Map([['import-u-10', measurementTakenAt]]),
      refuels: new Map(),
    })

  test('the same records keep them', () => {
    const plan = planImport(
      legacy(takenAt.getTime()),
      [localTank()],
      [local()],
      NOW
    )
    expect(plan.tanks[0]?.id).toBe('import-u-3')
    expect(plan.measurements[0]).toMatchObject({
      id: 'import-u-10',
      tankId: 'import-u-3',
    })
  })

  test("another phone's records get new ones", () => {
    const plan = planImport(
      legacy(takenAt.getTime() - 60_000),
      [localTank({ capacity: 80 })],
      [local()],
      NOW
    )
    expect(plan.tanks[0]?.id).toBe('import-org-1-u-dev1-3')
    expect(plan.measurements[0]?.id).toBe('import-org-1-u-dev1-10')
  })
})

// Regression: a capacity with many decimals made the name longer than the
// 40 characters the rules allow, and the whole batch of tanks was rejected
test('the imported tank name fits in 40 characters', () => {
  const plan = planImport(
    idsFor('u'),
    [localTank({ capacity: 123.12345678901 })],
    [local({ gallons: '10', liters: '37.85' })],
    NOW
  )
  expect(plan.tanks[0]?.name).toBe('Tanque de 123.12 gal (importado)')
  expect(plan.tanks[0]?.name.length).toBeLessThanOrEqual(40)
})
