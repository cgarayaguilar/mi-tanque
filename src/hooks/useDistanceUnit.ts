import { useState } from 'react'
import { useSessionStore } from 'store/session'

/**
 * The active organization's distance unit (backend specs/0010). It is known
 * when the session is ready: an organization from before the setting gets it
 * settled then (services/session), never guessed from the loaded trucks.
 */
export const useDistanceUnit = () =>
  useSessionStore(state => state.organization?.distanceUnit ?? 'km')

/**
 * The unit when a form opened, for both showing and saving its numbers: a
 * change of the organization's unit while it is open cannot convert them
 * twice (audit 2026-10-02).
 */
export const useFormDistanceUnit = () => {
  const unit = useDistanceUnit()
  const [pinned] = useState(unit)
  return pinned
}
