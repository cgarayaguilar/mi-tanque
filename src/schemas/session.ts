// zod/mini: same validation as zod with a fraction of the bundle (§5.8)
import * as z from 'zod/mini'
import { CURRENCIES } from 'schemas/account'
import { ROLES } from 'utils/roles'

// The account as the `account` callable writes it (specs/0002, 0005). Pure:
// the session store validates the callable's answer with it without loading
// the Firebase SDK (backend specs/0020 RF-2).

export const profileSchema = z.object({
  displayName: z.string(),
  // null after leaving or being removed from the last one (specs/0005)
  activeOrgId: z.nullable(z.string()),
})
export const membershipSchema = z.object({
  orgId: z.string(),
  role: z.enum(ROLES),
  orgName: z.string(),
})
export const organizationSchema = z.object({
  name: z.string(),
  defaultCurrency: z.enum(CURRENCIES),
  // Missing in organizations from before specs/0010: see utils/distanceUnit
  distanceUnit: z.optional(z.nullable(z.enum(['km', 'mi']))),
})

export type Profile = z.infer<typeof profileSchema>
export type Membership = z.infer<typeof membershipSchema>
export type Organization = z.infer<typeof organizationSchema> & { id: string }

/**
 * What `bootstrap` and `createOrganization` answer since specs/0020 RF-1: the
 * account to enter with, read in the transaction that wrote it.
 */
const enteredSchema = z.object({
  orgId: z.string(),
  account: z.object({
    profile: z.object({ displayName: z.string(), activeOrgId: z.string() }),
    membership: membershipSchema,
    organization: z.extend(organizationSchema, { id: z.string() }),
  }),
})

export type EnteredAccount = z.infer<typeof enteredSchema>['account']

/** The account in the callable's answer; null from a backend before 0020. */
export const enteredAccountFrom = (result: unknown): EnteredAccount | null => {
  const parsed = enteredSchema.safeParse(result)
  return parsed.success ? parsed.data.account : null
}
