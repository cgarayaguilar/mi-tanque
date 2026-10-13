import { useState } from 'react'
import { format } from 'date-fns'
import { AutocompleteBase } from 'components/AutocompleteField'
import { tripOption, useTripChoices } from 'hooks/useTripChoices'
import { routeName } from 'schemas/rates'
import { NO_TRIP, type TripLink } from 'schemas/tripLink'
import {
  tripInProgress,
  tripsForEquipment,
  type EquipmentRef,
} from 'utils/tripOfEquipment'

// "Sin viaje" in the list
const NONE = ''

interface TripLinkOptions {
  /** The field's id. */
  id: string
  orgId: string
  /** The tank's truck or trailer: the trips offered carry it. */
  equipment: EquipmentRef
  /** When it was measured or refueled. */
  at: Date
  /** Its trip when correcting it; undefined for a new one. */
  saved?: TripLink
}

/**
 * "Viaje (opcional)" of a measurement or refuel (backend specs/0042 RF-2,
 * RF-3): the trips near its date that carry its truck or trailer. A new one
 * comes with the trip in progress then, if any; one corrected, with its
 * own. Without the trips (no signal), "Sin viaje", and it saves all the same.
 */
export const useTripLink = ({
  id,
  orgId,
  equipment,
  at,
  saved,
}: TripLinkOptions) => {
  const { choices, loading } = useTripChoices(
    orgId,
    format(at, 'yyyy-MM-dd'),
    []
  )
  // null until the person picks
  const [picked, setPicked] = useState<string | null>(null)
  const offered = tripsForEquipment(choices, equipment)
  const initial =
    saved === undefined
      ? (tripInProgress(choices, equipment, at)?.id ?? NONE)
      : (saved.tripId ?? NONE)
  const value = picked ?? initial
  const chosen = choices.find(trip => trip.id === value)
  // Its own trip stays offered though it is no longer near, or gone
  const keepsSaved =
    saved?.tripId != null && !offered.some(trip => trip.id === saved.tripId)
  const link: TripLink =
    value === NONE
      ? NO_TRIP
      : chosen
        ? {
            tripId: chosen.id,
            tripRoute: routeName(chosen.origin, chosen.destination),
          }
        : saved?.tripId === value
          ? saved
          : NO_TRIP

  const field = (
    <AutocompleteBase
      id={id}
      label="Viaje (opcional)"
      options={[
        { value: NONE, label: 'Sin viaje' },
        ...offered.map(tripOption),
        ...(keepsSaved && saved.tripId
          ? [{ value: saved.tripId, label: saved.tripRoute ?? 'Viaje' }]
          : []),
      ]}
      value={value}
      onChange={next => {
        setPicked(next)
      }}
      hint={loading ? 'Buscando los viajes…' : undefined}
    />
  )
  return { link, field }
}
