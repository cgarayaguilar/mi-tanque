import { useEffect } from 'react'
import { useTripLink } from 'hooks/useTripLink'
import type { TripLink } from 'schemas/tripLink'
import type { EquipmentRef } from 'utils/tripOfEquipment'

interface TripLinkPickerProps {
  id: string
  orgId: string
  equipment: EquipmentRef
  at: Date
  /** Its trip when correcting it; undefined for a new one. */
  saved?: TripLink
  /** The trip chosen, every time it changes. */
  onChange: (link: TripLink) => void
}

/**
 * "Viaje (opcional)" for a form that is not this one's (backend specs/0042
 * RF-3): a refuel's correction, inside the list shared with the basic mode.
 */
export default function TripLinkPicker({
  onChange,
  ...options
}: TripLinkPickerProps) {
  const { link, field } = useTripLink(options)
  const { tripId, tripRoute } = link
  useEffect(() => {
    onChange({ tripId, tripRoute })
  }, [tripId, tripRoute, onChange])
  return field
}
