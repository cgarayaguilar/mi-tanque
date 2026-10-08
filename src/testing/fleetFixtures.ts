import type { Client } from 'schemas/clients'
import type { Driver } from 'schemas/drivers'
import {
  presetCategoriesOf,
  type ExpenseCategory,
} from 'schemas/expenseCategories'
import type { Expense } from 'schemas/expenses'
import type { Rate } from 'schemas/rates'
import type { Trip } from 'schemas/trips'
import type { FleetTank, Trailer, Truck } from 'schemas/fleet'
import type { CloudMeasurement } from 'services/cloudMeasurements'
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
  insuranceExpiresOn: null,
  distanceUnit: 'km',
  fuelEfficiencyKmPerGal: 9.5,
  fuelEfficiencyEmptyKmPerGal: null,
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
  insuranceExpiresOn: null,
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
    lastMeasurement: null,
    equipment: { kind: 'truck', id: 'truck-1' },
    shape: 'd_flat_side',
    orientation: 'horizontal',
    dimensions: { heightIn: 24, widthIn: 30, lengthIn: 48 },
    ...overrides,
  }) as FleetTank

export const accountWithRole = (
  role: Role
): Omit<Account, 'needsContactSync'> => ({
  profile: { displayName: 'Luis', activeOrgId: ORG_ID },
  memberships: [{ orgId: ORG_ID, role, orgName: 'Flota de Luis' }],
  organization: { id: ORG_ID, name: 'Flota de Luis', defaultCurrency: 'NIO' },
})

export const cloudMeasurement = (
  overrides: Partial<CloudMeasurement> = {}
): CloudMeasurement => ({
  id: 'm-1',
  orgId: ORG_ID,
  tankId: 'tank-1',
  tankName: 'Tanque izquierdo',
  equipment: { kind: 'truck', id: 'truck-1', name: 'Unidad 12' },
  userId: 'luis',
  userName: 'Luis',
  takenAt: new Date(2026, 8, 30, 14, 5),
  createdAt: new Date(),
  location: { lat: 12.13, lng: -86.25, accuracyM: 12 },
  place: {
    country: 'Nicaragua',
    countryCode: 'NI',
    state: 'Managua',
    city: 'Managua',
  },
  placeStatus: 'done',
  legacyPlace: null,
  inches: 12,
  gallons: 70.5,
  liters: 266.87,
  fillPercent: 52.2,
  estimate: { km: 669.75, miles: 416.16, kmPerGal: 9.5 },
  estimateEmpty: null,
  odometerKm: 120500,
  source: 'app',
  ...overrides,
})

export const client = (overrides: Partial<Client> = {}): Client => ({
  id: 'client-1',
  orgId: ORG_ID,
  name: 'Transportes Pérez',
  phone: '8888 7777',
  email: null,
  taxId: 'J0310000012345',
  notes: null,
  archived: false,
  ...overrides,
})

export const driver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'driver-1',
  orgId: ORG_ID,
  name: 'Pedro Ruiz',
  phone: '8888 7777',
  licenseNumber: 'A-123456',
  licenseExpiresOn: null,
  memberUid: null,
  archived: false,
  ...overrides,
})

export const rate = (overrides: Partial<Rate> = {}): Rate => ({
  id: 'rate-1',
  orgId: ORG_ID,
  name: 'Managua → San José',
  origin: 'Managua',
  destination: 'San José',
  price: 25000,
  currency: 'NIO',
  clientId: 'client-1',
  clientName: 'Transportes Pérez',
  description: null,
  label: 'Managua - San José - C$25,000.00',
  archived: false,
  ...overrides,
})

export const trip = (overrides: Partial<Trip> = {}): Trip => ({
  id: 'trip-1',
  orgId: ORG_ID,
  status: 'scheduled',
  startAt: new Date(2026, 9, 6, 8, 0),
  endAt: null,
  year: 2026,
  month: 10,
  yearMonth: '2026-10',
  monthLabel: 'octubre 2026',
  weekStart: '2026-10-05',
  weekLabel: 'del 5 oct al 11 oct',
  mode: 'rate',
  rateId: 'rate-1',
  origin: 'Managua',
  destination: 'San José',
  price: 25000,
  extras: [{ description: 'Parada en León', amount: 2500 }],
  currency: 'NIO',
  clientId: 'client-1',
  clientName: 'Transportes Pérez',
  truckId: 'truck-1',
  truckName: 'Unidad 12',
  trailerId: 'trailer-1',
  trailerName: 'Caja 7',
  driverId: 'driver-1',
  driverName: 'Pedro Ruiz',
  secondDriverId: null,
  secondDriverName: null,
  driverIds: ['driver-1'],
  expensesTotal: 0,
  tripNumber: null,
  description: null,
  notes: null,
  createdAt: new Date(2026, 9, 6, 8, 15),
  createdBy: 'luis',
  ...overrides,
})

/** The nine an organization starts with (specs/0026 RF-1). */
export const presetCategories = (): ExpenseCategory[] =>
  presetCategoriesOf(ORG_ID)

/** A trip's toll: C$1,850 of "Peajes" on Managua → San José. */
export const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'expense-1',
  orgId: ORG_ID,
  takenAt: new Date(2026, 9, 6, 10, 30),
  amount: 1850,
  currency: 'NIO',
  categoryId: 'org-a_tolls',
  categoryName: 'Peajes',
  description: null,
  kind: 'trip',
  tripId: 'trip-1',
  tripRoute: 'Managua → San José',
  truckId: 'truck-1',
  truckName: 'Unidad 12',
  trailerId: 'trailer-1',
  trailerName: 'Caja 7',
  driverId: null,
  driverName: null,
  receiptPhotoPath: null,
  createdAt: new Date(2026, 9, 6, 10, 35),
  createdBy: 'luis',
  ...overrides,
})
