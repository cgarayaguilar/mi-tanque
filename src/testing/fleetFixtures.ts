import type { FleetTank, Trailer, Truck } from 'schemas/fleet'
import type { Account } from 'services/session'
import type { Role } from 'utils/roles'

export const ORG_ID = 'org-a'

export const truck = (overrides: Partial<Truck> = {}): Truck => ({
  id: 'truck-1',
  orgId: ORG_ID,
  name: 'Unidad 12',
  description: null,
  photoPath: null,
  archived: false,
  plate: 'M 123-456',
  brand: 'Freightliner',
  model: 'Cascadia',
  year: 2019,
  color: { swatch: 'red', label: 'Rojo' },
  vin: null,
  distanceUnit: 'km',
  fuelEfficiencyKmPerGal: 9.5,
  odometerKm: 120000,
  assignedDriverUid: null,
  ...overrides,
})

export const trailer = (overrides: Partial<Trailer> = {}): Trailer => ({
  id: 'trailer-1',
  orgId: ORG_ID,
  name: 'Caja 7',
  description: null,
  photoPath: null,
  archived: false,
  plate: null,
  brand: null,
  model: null,
  year: null,
  color: null,
  vin: null,
  trailerType: 'reefer',
  trailerTypeOther: null,
  lengthFt: 53,
  reeferConsumptionGalPerHour: 0.8,
  hitchedTruckId: 'truck-1',
  ...overrides,
})

export const tank = (overrides: Partial<FleetTank> = {}): FleetTank =>
  ({
    id: 'tank-1',
    orgId: ORG_ID,
    name: 'Tanque izquierdo',
    description: null,
    photoPath: null,
    archived: false,
    capacityGal: 135,
    templateId: null,
    equipment: { kind: 'truck', id: 'truck-1' },
    shape: 'd_flat_side',
    orientation: 'horizontal',
    dimensions: { heightIn: 24, widthIn: 30, lengthIn: 48 },
    ...overrides,
  }) as FleetTank

export const accountWithRole = (role: Role): Account => ({
  profile: { displayName: 'Luis', activeOrgId: ORG_ID },
  memberships: [{ orgId: ORG_ID, role, orgName: 'Flota de Luis' }],
  organization: { id: ORG_ID, name: 'Flota de Luis', defaultCurrency: 'NIO' },
})
