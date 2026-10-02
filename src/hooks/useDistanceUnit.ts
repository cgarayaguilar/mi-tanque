import { useEffect } from 'react'
import { useFleetStore } from 'store/fleet'
import { useSessionStore } from 'store/session'
import { organizationDistanceUnit } from 'utils/distanceUnit'

/** The active organization's distance unit (backend specs/0010). */
export const useDistanceUnit = () => {
  const saved = useSessionStore(state => state.organization?.distanceUnit)
  const trucks = useFleetStore(state => state.trucks)
  return organizationDistanceUnit(saved, trucks)
}

/**
 * The same where the fleet is not loaded (Mi cuenta): without a saved unit
 * it comes from the trucks (RF-3), so they are read.
 */
export const useOrganizationDistanceUnit = () => {
  const orgId = useSessionStore(state => state.organization?.id ?? null)
  const saved = useSessionStore(state => state.organization?.distanceUnit)
  const fleetOrgId = useFleetStore(state => state.orgId)
  const load = useFleetStore(state => state.load)
  useEffect(() => {
    if (!saved && orgId && fleetOrgId !== orgId) void load(orgId)
  }, [saved, orgId, fleetOrgId, load])
  return useDistanceUnit()
}
