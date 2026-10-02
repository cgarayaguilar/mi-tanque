import type { FleetTank } from 'schemas/fleet'
import { equipmentLabel } from 'hooks/equipmentLabel'

const tankOn = (kind: 'truck' | 'trailer' | 'none') =>
  ({
    equipment: kind === 'none' ? { kind, id: null } : { kind, id: 'eq-1' },
  }) as FleetTank

// Regression: a truck missing from the store gave an empty name, which the
// rules (1–40 characters) refused after "Medición guardada"
test('a truck or trailer not in the store still gets a name', () => {
  expect(equipmentLabel(tankOn('truck'), null)).toEqual({
    kind: 'truck',
    id: 'eq-1',
    name: 'Camión',
  })
  expect(equipmentLabel(tankOn('trailer'), '  ').name).toBe('Remolque')
  expect(equipmentLabel(tankOn('truck'), 'Unidad 12').name).toBe('Unidad 12')
  expect(equipmentLabel(tankOn('none'), null)).toEqual({
    kind: 'none',
    id: null,
    name: null,
  })
})
