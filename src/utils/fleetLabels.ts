import {
  KM_PER_MILE,
  TRAILER_TYPES,
  type FleetTank,
  type Trailer,
  type DistanceUnit,
  type Truck,
} from 'schemas/fleet'
import { formatNumber } from 'utils/formatNumber'

/** "Freightliner Cascadia 2019 · M 123-456" */
export const vehicleSubtitle = (item: Truck | Trailer) =>
  [[item.brand, item.model, item.year].filter(Boolean).join(' '), item.plate]
    .filter(Boolean)
    .join(' · ')

export const trailerTypeLabel = (trailer: Trailer) =>
  trailer.trailerType === 'other'
    ? (trailer.trailerTypeOther ?? 'Otro')
    : (TRAILER_TYPES.find(type => type.id === trailer.trailerType)?.label ?? '')

/** Efficiency and odometer in the organization's unit (backend specs/0010). */
export const truckFigures = (truck: Truck, unit: DistanceUnit) => {
  const fromKm = unit === 'mi' ? 1 / KM_PER_MILE : 1
  return {
    efficiency:
      truck.fuelEfficiencyKmPerGal === null
        ? null
        : `${formatNumber(truck.fuelEfficiencyKmPerGal * fromKm, 1)} ${unit}/gal`,
    odometer:
      truck.odometerKm === null
        ? null
        : `${formatNumber(Math.round(truck.odometerKm * fromKm))} ${unit}`,
  }
}

/** "Ø 25 × 26 pulg." or "24 × 30 × 48 pulg." */
export const tankMeasures = (tank: FleetTank) =>
  tank.shape === 'cylinder'
    ? `Ø ${formatNumber(tank.dimensions.diameterIn)} × ${formatNumber(tank.dimensions.lengthIn)} pulg.`
    : `${formatNumber(tank.dimensions.heightIn)} × ${formatNumber(tank.dimensions.widthIn)} × ${formatNumber(tank.dimensions.lengthIn)} pulg.`

// Short names for cards, where the long ones push the measurements out
const SHORT_SHAPE_LABELS: Record<FleetTank['shape'], string> = {
  cylinder: 'Cilíndrico',
  rectangular: 'Rectangular',
  d_flat_side: 'En "D" lado plano',
  d_flat_bottom: 'En "D" fondo plano',
}

export const tankShapeLabel = (tank: FleetTank) =>
  SHORT_SHAPE_LABELS[tank.shape]
