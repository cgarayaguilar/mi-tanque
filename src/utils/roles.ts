/** Organization roles (backend docs/adr/0002), defined once (§5.3). */
export const ROLES = ['owner', 'supervisor', 'driver', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Dueño',
  supervisor: 'Supervisor',
  driver: 'Chofer',
  viewer: 'Lectura',
}

/** The single check for editing the organization itself (§5.3). */
export const canEditOrganization = (role: Role | null | undefined) =>
  role === 'owner'
