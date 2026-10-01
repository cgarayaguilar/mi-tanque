import type { Measurement, Tank } from 'types'
import { importId, planImport } from 'utils/importPlan'
import { calcFuelLevel } from 'utils/calcFuelLevel'

const NOW = new Date(2026, 9, 1, 12, 0)

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
    'uid-1',
    [localTank(), localTank({ id: 4 })],
    [local()],
    NOW
  )

  // Tank 4 has no measurements: it is not brought
  expect(plan.tanks).toEqual([
    {
      id: 'import-uid-1-3',
      name: 'Tanque de 75 gal (importado)',
      capacityGal: 75,
      diameterIn: 25,
      lengthIn: 39,
      templateId: 'cyl-75-25x39',
    },
  ])
})

test('measurements keep their date, amounts and place, with the percent by volume (RF-16)', () => {
  const plan = planImport('uid-1', [localTank()], [local()], NOW)
  const full = calcFuelLevel({
    tankDiameter: 25,
    tankLength: 39,
    fuelHeight: 25,
  })

  expect(plan.measurements).toEqual([
    {
      id: 'import-uid-1-10',
      tankId: 'import-uid-1-3',
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
  const first = planImport('uid-1', [localTank()], [local()], NOW)
  const second = planImport('uid-1', [localTank()], [local()], NOW)
  expect(second).toEqual(first)
  expect(importId('uid-1', 10)).toBe('import-uid-1-10')
})

test('"Sin ubicación" and blanks become no place; long places are cut to 120', () => {
  const plan = planImport(
    'u',
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
    'u',
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
  expect(plan.measurements.map(m => m.id)).toEqual(['import-u-8'])
  expect(plan.skipped).toBe(7)
  expect(plan.tanks.map(t => t.id)).toEqual(['import-u-3'])
})

test('a tank that is not a template keeps no template', () => {
  const plan = planImport('u', [localTank({ capacity: 80 })], [local()], NOW)
  expect(plan.tanks[0]?.templateId).toBeNull()
})
