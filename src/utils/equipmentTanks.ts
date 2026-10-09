import {
  equipmentToValue,
  type FleetTank,
  type Trailer,
  type Truck,
} from 'schemas/fleet'
import { tankMeasures, tankShapeLabel } from 'utils/fleetLabels'
import { formatNumber } from 'utils/formatNumber'
import { templateById } from 'utils/tankTemplates'

/** A truck or a trailer carries up to 2 tanks (backend specs/0032 RF-6). */
export const TANKS_PER_EQUIPMENT = 2

/** The active tanks of an equipment ('truck:{id}'). */
export const tanksOfEquipment = (
  equipment: string,
  tanks: readonly FleetTank[]
) =>
  tanks.filter(
    tank => !tank.archived && equipmentToValue(tank.equipment) === equipment
  )

/**
 * The name of `equipment` if it already has its 2 active tanks without the
 * tank `tankId`; null if it has room, or is "sin equipo". A tank already
 * there keeps its place, even with more than 2 from before (RF-6).
 */
export const equipmentWithoutRoom = (
  equipment: string,
  tankId: string,
  fleet: {
    trucks: readonly Truck[]
    trailers: readonly Trailer[]
    tanks: readonly FleetTank[]
  }
) => {
  if (equipment === 'none') return null
  const others = tanksOfEquipment(equipment, fleet.tanks)
  if (others.some(tank => tank.id === tankId)) return null
  if (others.length < TANKS_PER_EQUIPMENT) return null
  const [kind, id] = equipment.split(':')
  return (
    (kind === 'truck' ? fleet.trucks : fleet.trailers).find(
      item => item.id === id
    )?.name ?? 'Este equipo'
  )
}

/** A tank's card lines: "Cilíndrico · Ø 26 × 48 pulg.", "100 gal · …". */
export const tankCardLines = (tank: FleetTank) => {
  const template = templateById(tank.templateId)
  return [
    `${tankShapeLabel(tank)} · ${tankMeasures(tank)}`,
    [
      `${formatNumber(tank.capacityGal)} gal`,
      template &&
        [template.brand, template.models[0]].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(' · '),
  ]
}
