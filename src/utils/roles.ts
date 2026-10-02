/** Organization roles (backend docs/adr/0002), defined once (§5.3). */
export const ROLES = ['owner', 'supervisor', 'driver', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Dueño',
  supervisor: 'Supervisor',
  driver: 'Chofer',
  viewer: 'Lectura',
}

/**
 * The single check for editing the organization itself (§5.3): its name,
 * currency and distance unit, by owners and supervisors (specs/0010 RF-2).
 */
export const canEditOrganization = (role: Role | null | undefined) =>
  role === 'owner' || role === 'supervisor'

/** Owner, supervisor and driver manage the fleet; Lectura only reads (specs/0003). */
export const canWriteFleet = (role: Role | null | undefined) =>
  role === 'owner' || role === 'supervisor' || role === 'driver'

// Who manages whom (backend specs/0005); the `team` callable decides, the UI
// only hides what the role cannot do. Same rules as functions/src/team/policy.ts
const MANAGED_BY_SUPERVISOR: readonly Role[] = ['driver', 'viewer']

/** Roles an invitation can carry: never owner. */
export const INVITABLE_ROLES = ['supervisor', 'driver', 'viewer'] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

/** Whether `actor` may change the role of, remove or revoke for `target`. */
export const canManageMember = (actor: Role | null | undefined, target: Role) =>
  actor === 'owner' ||
  (actor === 'supervisor' && MANAGED_BY_SUPERVISOR.includes(target))

/** The roles `actor` may invite with. */
export const invitableRolesFor = (
  actor: Role | null | undefined
): InvitableRole[] =>
  INVITABLE_ROLES.filter(role => canManageMember(actor, role))

/** The roles `actor` may give someone (only owners make owners). */
export const assignableRolesFor = (actor: Role | null | undefined): Role[] =>
  ROLES.filter(role => canManageMember(actor, role))

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Who edits or deletes a measurement or refuel (backend specs/0004 RF-14,
 * specs/0006 RF-11): the author within 24 hours, owner and supervisor
 * always. Same rule as firestore.rules.
 */
export const canChangeReading = (
  reading: { userId: string; createdAt: Date | null },
  role: Role | null | undefined,
  uid: string | undefined,
  now = Date.now()
) =>
  role === 'owner' ||
  role === 'supervisor' ||
  (canWriteFleet(role) &&
    reading.userId === uid &&
    now - (reading.createdAt?.getTime() ?? now) < EDIT_WINDOW_MS)
