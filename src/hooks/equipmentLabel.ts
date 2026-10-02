import type { FleetTank } from 'schemas/fleet'

/**
 * The equipment as a reading stores it. The name comes from the fleet store;
 * if the truck or trailer is not there (still loading, or left out), a
 * generic name keeps the reading within the rules, which ask 1–40
 * characters (audit 2026-10-01 #15).
 */
export const equipmentLabel = (
  tank: FleetTank,
  name: string | null
):
  | { kind: 'none'; id: null; name: null }
  | { kind: 'truck' | 'trailer'; id: string; name: string } =>
  tank.equipment.kind === 'none'
    ? { kind: 'none', id: null, name: null }
    : {
        kind: tank.equipment.kind,
        id: tank.equipment.id,
        name:
          name?.trim().slice(0, 40) ||
          (tank.equipment.kind === 'truck' ? 'Camión' : 'Remolque'),
      }
