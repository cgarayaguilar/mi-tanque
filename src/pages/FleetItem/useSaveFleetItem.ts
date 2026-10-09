import { useLocation } from 'wouter'
import { useCreateFleetItem } from 'hooks/useCreateFleetItem'
import type { FleetSection } from 'utils/fleetSections'

/** Saves a fleet item from its screen, then goes back to its list. */
export const useSaveFleetItem = (section: FleetSection) => {
  const saveItem = useCreateFleetItem(section)
  const [, navigate] = useLocation()

  return (...args: Parameters<typeof saveItem>): void => {
    saveItem(...args)
    navigate(`/flota/${section.slug}`)
  }
}
