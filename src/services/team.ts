// The team of an organization (backend specs/0005). Imports the SDK
// statically: only lazy pages (Account, Invitation) import it directly.
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import * as z from 'zod/mini'
import { loadFirebase } from 'services/firebase'
import {
  INVITABLE_ROLES,
  ROLES,
  type InvitableRole,
  type Role,
} from 'utils/roles'

// Bounded reads (§2.3)
const MAX_MEMBERS = 200
const MAX_PENDING = 20

export interface TeamMember {
  uid: string
  displayName: string
  role: Role
  email: string | null
  phoneNumber: string | null
}

const memberSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  role: z.enum(ROLES),
  email: z.optional(z.nullable(z.string())),
  phoneNumber: z.optional(z.nullable(z.string())),
})

const ROLE_ORDER: Record<Role, number> = {
  owner: 0,
  supervisor: 1,
  driver: 2,
  viewer: 3,
}

/** The members, by role and then by name (RF-8). */
export const readTeam = async (orgId: string): Promise<TeamMember[]> => {
  const { db } = await loadFirebase()
  const snapshot = await getDocs(
    query(
      collection(db, 'members'),
      where('orgId', '==', orgId),
      limit(MAX_MEMBERS)
    )
  )
  return snapshot.docs
    .map(document => memberSchema.safeParse(document.data()))
    .filter(result => result.success)
    .map(({ data }) => ({
      ...data,
      email: data.email ?? null,
      phoneNumber: data.phoneNumber ?? null,
    }))
    .sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        a.displayName.localeCompare(b.displayName, 'es')
    )
}

export interface PendingInvitation {
  id: string
  role: InvitableRole
  createdByName: string
  expiresAt: Date
}

const invitationSchema = z.object({
  role: z.enum(INVITABLE_ROLES),
  createdByName: z.string(),
  expiresAt: z.instanceof(Timestamp),
})

/** Links not used, revoked or expired; owners and supervisors only (RF-2). */
export const readPendingInvitations = async (
  orgId: string
): Promise<PendingInvitation[]> => {
  const { db } = await loadFirebase()
  const snapshot = await getDocs(
    query(
      collection(db, 'invitations'),
      where('orgId', '==', orgId),
      where('status', '==', 'pending'),
      where('expiresAt', '>', Timestamp.now()),
      orderBy('expiresAt'),
      limit(MAX_PENDING)
    )
  )
  return snapshot.docs.flatMap(document => {
    const parsed = invitationSchema.safeParse(document.data())
    return parsed.success
      ? [
          {
            id: document.id,
            role: parsed.data.role,
            createdByName: parsed.data.createdByName,
            expiresAt: parsed.data.expiresAt.toDate(),
          },
        ]
      : []
  })
}

/**
 * Organizations where the caller is the only owner and others remain: the
 * account cannot be deleted until someone else owns them (RF-14).
 */
export const readOwnershipBlocks = async (
  memberships: readonly { orgId: string; orgName: string; role: Role }[]
): Promise<string[]> => {
  const { db } = await loadFirebase()
  const owned = memberships.filter(membership => membership.role === 'owner')
  const counts = await Promise.all(
    owned.map(async ({ orgId }) => {
      const members = query(
        collection(db, 'members'),
        where('orgId', '==', orgId)
      )
      const [all, owners] = await Promise.all([
        getCountFromServer(members),
        getCountFromServer(query(members, where('role', '==', 'owner'))),
      ])
      return { all: all.data().count, owners: owners.data().count }
    })
  )
  return owned
    .filter((_, index) => {
      const count = counts[index]
      return count !== undefined && count.owners === 1 && count.all > 1
    })
    .map(membership => membership.orgName)
}

export type TeamRequest =
  | { action: 'createInvitation'; orgId: string; role: InvitableRole }
  | { action: 'revokeInvitation'; orgId: string; invitationId: string }
  | { action: 'previewInvitation'; token: string }
  | { action: 'acceptInvitation'; token: string; displayName?: string }
  | { action: 'changeRole'; orgId: string; uid: string; role: Role }
  | { action: 'removeMember'; orgId: string; uid: string }
  | { action: 'leave'; orgId: string }

/** The backend `team` callable (specs/0005). Needs a connection. */
export const callTeam = async (request: TeamRequest): Promise<unknown> => {
  const { functions } = await loadFirebase()
  const result = await httpsCallable(functions, 'team')(request)
  return result.data
}

export interface InvitationPreview {
  orgName: string
  role: InvitableRole
  invitedBy: string
  expiresAt: string
  state: 'pending' | 'expired' | 'accepted'
  memberOrgId: string | null
}

export const previewInvitation = async (token: string) =>
  (await callTeam({ action: 'previewInvitation', token })) as InvitationPreview

export const createInvitation = async (orgId: string, role: InvitableRole) =>
  (await callTeam({ action: 'createInvitation', orgId, role })) as {
    token: string
    expiresAt: string
  }

/** The link people open (RF-1). */
export const invitationLink = (token: string) =>
  `${window.location.origin}/invitacion/${token}`
